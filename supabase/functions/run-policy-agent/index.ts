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

    // Update status to review
    await supabase.from("kanban_cards").update({ status: "review", updated_at: new Date().toISOString() }).eq("id", card_id);

    // Fetch brand profile for the card's user
    const { data: brandProfile } = await supabase.from("brand_profiles").select("*").eq("user_id", card.user_id).maybeSingle();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const brandContext = brandProfile
      ? `Brand: ${brandProfile.company_name || "Unknown"}\nVoice: ${brandProfile.brand_voice || "Professional"}\nBio: ${brandProfile.company_bio || "N/A"}`
      : "No brand profile configured. Use general best practices.";

    const systemPrompt = `You are a brand compliance officer. Review the content against company policies and brand guidelines.

Brand Information:
${brandContext}

Check the following:
1. Brand Voice Match - Does the tone align with the brand?
2. Content Quality - Is it well-written, engaging, and error-free?
3. Platform Best Practices - Does it follow ${card.platform} conventions?
4. CTA Effectiveness - Is the call to action clear and compelling?
5. Professionalism - No controversial, offensive, or off-brand content

You MUST respond with ONLY a valid JSON object (no markdown, no fences):
{"approved": boolean, "score": number, "feedback": ["string"], "suggested_edits": "string", "final_content": "string"}

Score guidelines:
- 75-100: High quality, on-brand, ready to publish
- 60-74: Acceptable but needs minor edits (human review)
- Below 60: Significant issues, needs rewrite

If score >= 75, set approved=true and provide polished final_content.
If score < 75, set approved=false and provide detailed feedback and suggested_edits.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Review this ${card.platform} content (${card.tone} tone):\n\n${card.draft_content || "No draft available."}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "policy_review",
              description: "Return the policy review result",
              parameters: {
                type: "object",
                properties: {
                  approved: { type: "boolean" },
                  score: { type: "number", minimum: 0, maximum: 100 },
                  feedback: { type: "array", items: { type: "string" } },
                  suggested_edits: { type: "string" },
                  final_content: { type: "string" },
                },
                required: ["approved", "score", "feedback", "suggested_edits", "final_content"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "policy_review" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${status}`);
    }

    const data = await response.json();

    // Extract from tool call or fallback to message content
    let review: { approved: boolean; score: number; feedback: string[]; suggested_edits: string; final_content: string };
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      review = JSON.parse(toolCall.function.arguments);
    } else {
      // Fallback: try parsing message content
      const raw = data.choices?.[0]?.message?.content || "{}";
      const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      review = JSON.parse(cleaned);
    }

    // Determine status based on score
    let newStatus: string;
    if (review.score >= 75) {
      newStatus = "approved";
    } else if (review.score >= 60) {
      newStatus = "review"; // human approval needed
    } else {
      newStatus = "rejected";
    }

    await supabase.from("kanban_cards").update({
      policy_score: review.score,
      policy_feedback: review.feedback || [],
      suggested_edits: review.suggested_edits || null,
      final_content: review.score >= 75 ? (review.final_content || card.draft_content) : null,
      status: newStatus,
      updated_at: new Date().toISOString(),
    }).eq("id", card_id);

    return new Response(JSON.stringify({ success: true, review }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Policy agent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
