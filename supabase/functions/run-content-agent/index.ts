import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { card_id } = await req.json();
    if (!card_id) return new Response(JSON.stringify({ error: "card_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: card, error: cardErr } = await supabase.from("kanban_cards").select("*").eq("id", card_id).single();
    if (cardErr || !card) return new Response(JSON.stringify({ error: "Card not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Update status to drafting
    await supabase.from("kanban_cards").update({ status: "drafting", updated_at: new Date().toISOString() }).eq("id", card_id);

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!GROQ_API_KEY && !LOVABLE_API_KEY) {
      throw new Error("Neither GROQ_API_KEY nor LOVABLE_API_KEY is configured");
    }

    const apiUrl = GROQ_API_KEY ? "https://api.groq.com/openai/v1/chat/completions" : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const apiKey = GROQ_API_KEY || LOVABLE_API_KEY;
    const model = GROQ_API_KEY ? "llama-3.3-70b-versatile" : "google/gemini-3-flash-preview";

    const platformFormats: Record<string, string> = {
      blog: "Write a full blog article with introduction, 3-5 sections with headers, and conclusion. 800-1200 words.",
      linkedin: "Write a LinkedIn post with a strong hook, value-driven body, and professional CTA. 150-300 words. Use line breaks for readability.",
      twitter: "Write a Twitter/X thread of 5-8 tweets. Each tweet under 280 characters. Number them. First tweet is the hook.",
      instagram: "Write an Instagram caption with emoji, storytelling hook, value content, hashtags, and CTA. 150-250 words.",
      email: "Write a newsletter email with subject line, preview text, greeting, main content sections, and CTA. 400-600 words.",
    };

    const systemPrompt = `You are an expert content writer. Using the research provided, write compelling content for ${card.platform} in ${card.tone} tone.

Format requirements for ${card.platform}:
${platformFormats[card.platform] || platformFormats.blog}

Structure your output as:
[Hook] - Opening that grabs attention
[Main Body] - Core content
[CTA] - Call to action

Write naturally and engagingly. Avoid generic filler.`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Topic: "${card.topic}"\nTitle: "${card.title}"\n\nResearch notes:\n${card.search_result || "No research available."}` },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${status}`);
    }

    const data = await response.json();
    const draftContent = data.choices?.[0]?.message?.content || "No draft generated.";

    await supabase.from("kanban_cards").update({
      draft_content: draftContent,
      status: "drafting",
      updated_at: new Date().toISOString(),
    }).eq("id", card_id);

    // Auto-trigger Policy Agent
    const policyAgentUrl = `${supabaseUrl}/functions/v1/run-policy-agent`;
    fetch(policyAgentUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ card_id }),
    }).catch(err => console.error("Failed to trigger policy agent:", err));

    return new Response(JSON.stringify({ success: true, draft_content: draftContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Content agent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
