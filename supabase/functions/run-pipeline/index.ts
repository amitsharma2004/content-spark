import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ChatOpenAI } from "npm:@langchain/openai@^0.5.0";
import { HumanMessage, SystemMessage } from "npm:@langchain/core@^0.3.0/messages";
import { ChatPromptTemplate } from "npm:@langchain/core@^0.3.0/prompts";
import { Annotation, StateGraph, END, START } from "npm:@langchain/langgraph@^0.2.0";
import { tool } from "npm:@langchain/core@^0.3.0/tools";
import { ToolNode } from "npm:@langchain/langgraph@^0.2.0/prebuilt";
import { z } from "npm:zod@^3.25.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------- LangGraph State Definition ----------

const PipelineState = Annotation.Root({
  cardId: Annotation<string>,
  topic: Annotation<string>,
  title: Annotation<string>,
  platform: Annotation<string>,
  tone: Annotation<string>,
  userId: Annotation<string>,
  searchResult: Annotation<string>({ default: () => "", reducer: (_, v) => v }),
  ragExamples: Annotation<string>({ default: () => "", reducer: (_, v) => v }),
  draftContent: Annotation<string>({ default: () => "", reducer: (_, v) => v }),
  policyScore: Annotation<number>({ default: () => 0, reducer: (_, v) => v }),
  policyFeedback: Annotation<string[]>({ default: () => [], reducer: (_, v) => v }),
  suggestedEdits: Annotation<string>({ default: () => "", reducer: (_, v) => v }),
  finalContent: Annotation<string>({ default: () => "", reducer: (_, v) => v }),
  approved: Annotation<boolean>({ default: () => false, reducer: (_, v) => v }),
  retryCount: Annotation<number>({ default: () => 0, reducer: (_, v) => v }),
  brandContext: Annotation<string>({ default: () => "", reducer: (_, v) => v }),
});

type PipelineStateType = typeof PipelineState.State;

// ---------- LLM Setup ----------

function createLLM() {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  return new ChatOpenAI({
    openAIApiKey: LOVABLE_API_KEY,
    modelName: "google/gemini-2.5-flash",
    configuration: {
      baseURL: "https://ai.gateway.lovable.dev/v1",
    },
    temperature: 0.7,
  });
}

// ---------- LangChain Tools for Search Agent ----------

const researchTool = tool(
  async ({ topic, platform, tone }: { topic: string; platform: string; tone: string }) => {
    const llm = createLLM();
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", `You are a research specialist. Given a content topic, find the most relevant angles, trending subtopics, key statistics, target audience pain points, and competitor content gaps. Return structured research notes with:
[Key Angles] - 3-5 unique angles to approach this topic
[Statistics to use] - Relevant data points and statistics
[Audience Pain Points] - What the target audience struggles with
[Recommended Keywords] - SEO-friendly keywords
[Content Hook Ideas] - 3 compelling hooks to open the content

Format the output clearly with headers and bullet points. The content is for {platform} platform in {tone} tone.`],
      ["human", `Research the following topic for a {platform} post: "{topic}"`],
    ]);

    const chain = prompt.pipe(llm);
    const result = await chain.invoke({ topic, platform, tone });
    return result.content as string;
  },
  {
    name: "deep_research",
    description: "Perform deep research on a topic to find angles, statistics, pain points, keywords, and hook ideas for content creation",
    schema: z.object({
      topic: z.string().describe("The topic to research"),
      platform: z.string().describe("Target platform (blog, linkedin, twitter, instagram, email)"),
      tone: z.string().describe("Content tone (professional, casual, humorous, formal, persuasive)"),
    }),
  }
);

const competitorAnalysisTool = tool(
  async ({ topic, platform }: { topic: string; platform: string }) => {
    const llm = createLLM();
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "You are a competitive analysis expert. Analyze what content already exists on this topic and identify gaps and opportunities. Return a brief analysis with: [Existing Content Themes], [Content Gaps], [Unique Angle Opportunities]."],
      ["human", "Analyze competitive content landscape for '{topic}' on {platform}."],
    ]);

    const chain = prompt.pipe(llm);
    const result = await chain.invoke({ topic, platform });
    return result.content as string;
  },
  {
    name: "competitor_analysis",
    description: "Analyze competitive content landscape for a topic on a specific platform",
    schema: z.object({
      topic: z.string().describe("The topic to analyze"),
      platform: z.string().describe("Target platform"),
    }),
  }
);

// ---------- Graph Nodes ----------

async function ragRetrievalNode(state: PipelineStateType): Promise<Partial<PipelineStateType>> {
  console.log("[LangGraph] RAG Retrieval running for:", state.topic);

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return { ragExamples: "" };

    const queryText = `${state.tone} ${state.topic} ${state.platform}`;

    // Generate query embedding
    const embResponse = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/text-embedding-3-small",
        input: queryText,
      }),
    });

    if (!embResponse.ok) {
      console.warn("RAG embedding failed:", embResponse.status);
      return { ragExamples: "" };
    }

    const embData = await embResponse.json();
    const queryEmbedding = embData.data?.[0]?.embedding;
    if (!queryEmbedding) return { ragExamples: "" };

    // Query vector DB
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: matches, error } = await supabase.rpc("match_posts", {
      query_embedding: `[${queryEmbedding.join(",")}]`,
      match_count: 5,
      filter_tone: state.tone,
      filter_platform: state.platform,
    });

    if (error || !matches || matches.length === 0) {
      console.log("[RAG] No matching examples found");
      return { ragExamples: "" };
    }

    const examples = matches
      .map((m: { post: string; similarity: number }, i: number) => `${i + 1}. ${m.post} (similarity: ${(m.similarity * 100).toFixed(0)}%)`)
      .join("\n");

    console.log(`[RAG] Found ${matches.length} example posts`);
    return { ragExamples: examples };
  } catch (err) {
    console.error("[RAG] Retrieval error:", err);
    return { ragExamples: "" };
  }
}

async function searchAgentNode(state: PipelineStateType): Promise<Partial<PipelineStateType>> {
  console.log("[LangGraph] Search Agent running for:", state.topic);

  const llm = createLLM();

  // Use tools via LangChain's tool binding
  const llmWithTools = llm.bindTools([researchTool, competitorAnalysisTool]);

  const orchestratorPrompt = ChatPromptTemplate.fromMessages([
    ["system", `You are a research orchestrator. Use the available tools to gather comprehensive research for content creation. 
Call the deep_research tool first, then call competitor_analysis to find gaps.
After gathering all research, synthesize the results into a final structured research brief.`],
    ["human", `Research topic: "{topic}" for {platform} in {tone} tone. Title: "{title}"`],
  ]);

  const messages = await orchestratorPrompt.formatMessages({
    topic: state.topic,
    platform: state.platform,
    tone: state.tone,
    title: state.title,
  });

  // Call LLM with tools - it may decide to call tools
  const response = await llmWithTools.invoke(messages);

  // If the model returned tool calls, execute them and synthesize
  let searchResult = "";

  if (response.tool_calls && response.tool_calls.length > 0) {
    const toolResults: string[] = [];
    for (const tc of response.tool_calls) {
      try {
        if (tc.name === "deep_research") {
          const result = await researchTool.invoke(tc.args);
          toolResults.push(`## Deep Research\n${result}`);
        } else if (tc.name === "competitor_analysis") {
          const result = await competitorAnalysisTool.invoke(tc.args);
          toolResults.push(`## Competitor Analysis\n${result}`);
        }
      } catch (err) {
        console.error(`Tool ${tc.name} failed:`, err);
      }
    }
    searchResult = toolResults.join("\n\n---\n\n");
  } else {
    searchResult = response.content as string;
  }

  // If no tool results, fall back to direct research
  if (!searchResult || searchResult.trim().length === 0) {
    const directResult = await researchTool.invoke({
      topic: state.topic,
      platform: state.platform,
      tone: state.tone,
    });
    searchResult = directResult;
  }

  return { searchResult };
}

async function contentAgentNode(state: PipelineStateType): Promise<Partial<PipelineStateType>> {
  console.log("[LangGraph] Content Agent running, retry:", state.retryCount);

  const llm = createLLM();

  const platformFormats: Record<string, string> = {
    blog: "Write a full blog article with introduction, 3-5 sections with headers, and conclusion. 800-1200 words.",
    linkedin: "Write a LinkedIn post with a strong hook, value-driven body, and professional CTA. 150-300 words. Use line breaks for readability.",
    twitter: "Write a Twitter/X thread of 5-8 tweets. Each tweet under 280 characters. Number them. First tweet is the hook.",
    instagram: "Write an Instagram caption with emoji, storytelling hook, value content, hashtags, and CTA. 150-250 words.",
    email: "Write a newsletter email with subject line, preview text, greeting, main content sections, and CTA. 400-600 words.",
  };

  // Build prompt with memory of previous feedback if retrying
  const feedbackContext = state.retryCount > 0 && state.policyFeedback.length > 0
    ? `\n\n⚠️ PREVIOUS ATTEMPT FEEDBACK (you MUST address these issues):\n${state.policyFeedback.map(f => `- ${f}`).join("\n")}\n\nSuggested edits: ${state.suggestedEdits}`
    : "";

  // Build RAG context from retrieved examples
  const ragContext = state.ragExamples
    ? `\n\n📚 EXAMPLE POSTS (use as style reference — do NOT copy them):\n${state.ragExamples}\n\nUse these examples to match the voice, style, and format. Create something original inspired by them.`
    : "";

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", `You are an expert content writer. Using the research provided, write compelling content for {platform} in {tone} tone.

Format requirements for {platform}:
{formatGuide}

Structure your output as:
[Hook] - Opening that grabs attention
[Main Body] - Core content
[CTA] - Call to action

Write naturally and engagingly. Avoid generic filler.{ragContext}{feedbackContext}`],
    ["human", `Topic: "{topic}"
Title: "{title}"

Research notes:
{searchResult}`],
  ]);

  const chain = prompt.pipe(llm);
  const result = await chain.invoke({
    topic: state.topic,
    title: state.title,
    platform: state.platform,
    tone: state.tone,
    formatGuide: platformFormats[state.platform] || platformFormats.blog,
    searchResult: state.searchResult || "No research available.",
    feedbackContext,
  });

  return { draftContent: result.content as string };
}

async function policyAgentNode(state: PipelineStateType): Promise<Partial<PipelineStateType>> {
  console.log("[LangGraph] Policy Agent running");

  const llm = createLLM();

  // Use LangChain structured output via tool calling
  const reviewSchema = z.object({
    approved: z.boolean().describe("Whether the content passes policy review"),
    score: z.number().min(0).max(100).describe("Quality score from 0-100"),
    feedback: z.array(z.string()).describe("List of feedback items"),
    suggested_edits: z.string().describe("Suggested edits to improve the content"),
    final_content: z.string().describe("Polished final version of the content"),
  });

  const llmStructured = llm.withStructuredOutput(reviewSchema, {
    name: "policy_review",
  });

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", `You are a brand compliance officer. Review the content against company policies and brand guidelines.

Brand Information:
{brandContext}

Check the following:
1. Brand Voice Match - Does the tone align with the brand?
2. Content Quality - Is it well-written, engaging, and error-free?
3. Platform Best Practices - Does it follow {platform} conventions?
4. CTA Effectiveness - Is the call to action clear and compelling?
5. Professionalism - No controversial, offensive, or off-brand content

Score guidelines:
- 75-100: High quality, on-brand, ready to publish
- 60-74: Acceptable but needs minor edits (human review)
- Below 60: Significant issues, needs rewrite

If score >= 75, set approved=true and provide polished final_content.
If score < 75, set approved=false and provide detailed feedback and suggested_edits.`],
    ["human", `Review this {platform} content ({tone} tone):\n\n{draftContent}`],
  ]);

  const chain = prompt.pipe(llmStructured);
  const review = await chain.invoke({
    platform: state.platform,
    tone: state.tone,
    draftContent: state.draftContent || "No draft available.",
    brandContext: state.brandContext || "No brand profile configured. Use general best practices.",
  });

  return {
    policyScore: review.score,
    policyFeedback: review.feedback,
    suggestedEdits: review.suggested_edits,
    finalContent: review.approved ? (review.final_content || state.draftContent) : "",
    approved: review.approved,
    retryCount: state.retryCount + 1,
  };
}

// ---------- Conditional Edge: Route after policy review ----------

function routeAfterPolicy(state: PipelineStateType): string {
  // If approved (score >= 75) → done
  if (state.approved || state.policyScore >= 75) {
    console.log("[LangGraph] Content approved with score:", state.policyScore);
    return "approved";
  }
  // If score < 60 and we haven't retried too many times → loop back to content agent
  if (state.policyScore < 60 && state.retryCount < 3) {
    console.log("[LangGraph] Score too low, looping back to content agent. Retry:", state.retryCount);
    return "retry";
  }
  // Otherwise → human review needed
  console.log("[LangGraph] Sending to human review. Score:", state.policyScore);
  return "human_review";
}

// ---------- Build the LangGraph ----------

function buildPipelineGraph() {
  const graph = new StateGraph(PipelineState)
    .addNode("search_agent", searchAgentNode)
    .addNode("rag_retrieval", ragRetrievalNode)
    .addNode("content_agent", contentAgentNode)
    .addNode("policy_agent", policyAgentNode)
    .addEdge(START, "search_agent")
    .addEdge("search_agent", "rag_retrieval")
    .addEdge("rag_retrieval", "content_agent")
    .addEdge("content_agent", "policy_agent")
    .addConditionalEdges("policy_agent", routeAfterPolicy, {
      approved: END,
      retry: "content_agent",  // Loop back with feedback!
      human_review: END,
    });

  return graph.compile();
}

// ---------- Serve ----------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { card_id } = await req.json();
    if (!card_id) {
      return new Response(JSON.stringify({ error: "card_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch card
    const { data: card, error: cardErr } = await supabase
      .from("kanban_cards")
      .select("*")
      .eq("id", card_id)
      .single();

    if (cardErr || !card) {
      return new Response(JSON.stringify({ error: "Card not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch brand profile
    const { data: brandProfile } = await supabase
      .from("brand_profiles")
      .select("*")
      .eq("user_id", card.user_id)
      .maybeSingle();

    const brandContext = brandProfile
      ? `Brand: ${brandProfile.company_name || "Unknown"}\nVoice: ${brandProfile.brand_voice || "Professional"}\nBio: ${brandProfile.company_bio || "N/A"}`
      : "No brand profile configured. Use general best practices.";

    // Update status to searching
    await supabase
      .from("kanban_cards")
      .update({ status: "searching", updated_at: new Date().toISOString() })
      .eq("id", card_id);

    // Build and run the LangGraph pipeline
    const pipeline = buildPipelineGraph();

    const initialState = {
      cardId: card_id,
      topic: card.topic,
      title: card.title,
      platform: card.platform,
      tone: card.tone,
      userId: card.user_id,
      brandContext,
    };

    // Stream state updates to the database as the graph runs
    let lastStatus = "searching";
    const result = await pipeline.invoke(initialState, {
      callbacks: [
        {
          handleChainStart: async (_chain: unknown, _inputs: unknown, _runId: string, _parentRunId: string | undefined, _tags: string[] | undefined, metadata: Record<string, unknown> | undefined) => {
            const nodeName = metadata?.langgraph_node as string | undefined;
            if (!nodeName) return;

            let newStatus = lastStatus;
            if (nodeName === "search_agent") newStatus = "searching";
            else if (nodeName === "content_agent") newStatus = "drafting";
            else if (nodeName === "policy_agent") newStatus = "review";

            if (newStatus !== lastStatus) {
              lastStatus = newStatus;
              await supabase
                .from("kanban_cards")
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq("id", card_id);
            }
          },
        },
      ],
    });

    // Determine final status
    let finalStatus: string;
    if (result.approved || result.policyScore >= 75) {
      finalStatus = "approved";
    } else if (result.policyScore >= 60) {
      finalStatus = "review";
    } else {
      finalStatus = "rejected";
    }

    // Save final state to database
    await supabase.from("kanban_cards").update({
      search_result: result.searchResult,
      draft_content: result.draftContent,
      policy_score: result.policyScore,
      policy_feedback: result.policyFeedback || [],
      suggested_edits: result.suggestedEdits || null,
      final_content: result.policyScore >= 75 ? (result.finalContent || result.draftContent) : null,
      status: finalStatus,
      updated_at: new Date().toISOString(),
    }).eq("id", card_id);

    return new Response(
      JSON.stringify({
        success: true,
        finalStatus,
        policyScore: result.policyScore,
        retries: result.retryCount,
        approved: result.approved,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Pipeline error:", e);

    // Handle rate limit and credit errors
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg.includes("429") || msg.includes("rate")) {
      return new Response(JSON.stringify({ error: "Rate limited — please try again in a moment." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (msg.includes("402") || msg.includes("credits")) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
