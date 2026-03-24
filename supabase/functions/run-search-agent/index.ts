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

    // Fetch card
    const { data: card, error: cardErr } = await supabase.from("kanban_cards").select("*").eq("id", card_id).single();
    if (cardErr || !card) return new Response(JSON.stringify({ error: "Card not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Update status to searching
    await supabase.from("kanban_cards").update({ status: "searching", updated_at: new Date().toISOString() }).eq("id", card_id);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a research specialist. Given a content topic, find the most relevant angles, trending subtopics, key statistics, target audience pain points, and competitor content gaps. Return structured research notes with:
[Key Angles] - 3-5 unique angles to approach this topic
[Statistics to use] - Relevant data points and statistics
[Audience Pain Points] - What the target audience struggles with
[Recommended Keywords] - SEO-friendly keywords
[Content Hook Ideas] - 3 compelling hooks to open the content

Format the output clearly with headers and bullet points. The content is for ${card.platform} platform in ${card.tone} tone.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Research the following topic for a ${card.platform} post: "${card.topic}". Title: "${card.title}"` },
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
    const searchResult = data.choices?.[0]?.message?.content || "No research results generated.";

    // Save search result
    await supabase.from("kanban_cards").update({
      search_result: searchResult,
      status: "searching",
      updated_at: new Date().toISOString(),
    }).eq("id", card_id);

    // Auto-trigger Content Agent
    const contentAgentUrl = `${supabaseUrl}/functions/v1/run-content-agent`;
    fetch(contentAgentUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ card_id }),
    }).catch(err => console.error("Failed to trigger content agent:", err));

    return new Response(JSON.stringify({ success: true, search_result: searchResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Search agent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
