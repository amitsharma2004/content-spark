import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { content, instruction } = await req.json();
    if (!content || !instruction) {
      return new Response(
        JSON.stringify({ error: "content and instruction are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try Groq API, fallback to Lovable Gateway or Google API
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    
    if (!GROQ_API_KEY && !LOVABLE_API_KEY && !GOOGLE_API_KEY) {
      throw new Error("Neither GROQ_API_KEY, LOVABLE_API_KEY, nor GOOGLE_API_KEY is configured");
    }
    
    const useOpenAiCompatible = !!GROQ_API_KEY || !!LOVABLE_API_KEY;

    const systemPrompt = `You are a content editing expert. The user will give you a piece of social media content and a refinement instruction. Apply the instruction and return ONLY the refined text — no explanation, no quotes, no markdown fences. Keep the same language and approximate length unless the instruction says otherwise.`;

    let response;
    if (GROQ_API_KEY) {
      response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Original content:\n\n${content}\n\nInstruction: ${instruction}` },
          ],
          temperature: 0.7,
        }),
      });
    } else if (LOVABLE_API_KEY) {
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Original content:\n\n${content}\n\nInstruction: ${instruction}` },
          ],
          stream: false,
        }),
      });
    } else {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: systemPrompt },
                { text: `Original content:\n\n${content}\n\nInstruction: ${instruction}` }
              ]
            }],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
            }
          }),
        }
      );
    }

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const refined = useOpenAiCompatible
      ? data.choices?.[0]?.message?.content?.trim()
      : data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!refined) throw new Error("No content returned from AI");

    return new Response(
      JSON.stringify({ refined }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("refine-content error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
