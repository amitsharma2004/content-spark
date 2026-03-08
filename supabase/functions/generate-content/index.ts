import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function extractJson(raw: string): Record<string, unknown> {
  let cleaned = raw.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in AI response");
  cleaned = cleaned.substring(start, end + 1);

  try {
    return JSON.parse(cleaned);
  } catch {
    // Repair common LLM issues
  }

  cleaned = cleaned
    .replace(/,\s*]/g, "]")
    .replace(/,\s*}/g, "}");

  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, (ch) =>
    ch === "\n" || ch === "\r" || ch === "\t" ? ch : ""
  );

  let braces = 0, brackets = 0;
  for (const c of cleaned) {
    if (c === "{") braces++;
    if (c === "}") braces--;
    if (c === "[") brackets++;
    if (c === "]") brackets--;
  }
  while (brackets > 0) { cleaned += "]"; brackets--; }
  while (braces > 0) { cleaned += "}"; braces--; }

  return JSON.parse(cleaned);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { topic, tone = 'professional' } = await req.json();
    if (!topic) {
      return new Response(JSON.stringify({ error: "Topic is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try Lovable Gateway first, fallback to Google API
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    
    if (!LOVABLE_API_KEY && !GOOGLE_API_KEY) {
      throw new Error("Either LOVABLE_API_KEY or GOOGLE_API_KEY must be configured");
    }
    
    const useLovableGateway = !!LOVABLE_API_KEY;

    // Fetch brand profile for the calling user
    let brandContext = "";
    try {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const sb = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await sb.auth.getUser();
        if (user) {
          const { data: profile } = await sb
            .from("brand_profiles")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle();

          if (profile) {
            const parts: string[] = [];
            if (profile.company_name) parts.push(`Company: ${profile.company_name}`);
            if (profile.company_bio) parts.push(`About: ${profile.company_bio}`);
            if (profile.brand_voice) parts.push(`Voice guidelines: ${profile.brand_voice}`);
            if (profile.sample_posts?.length) {
              parts.push(`Sample posts to emulate:\n${profile.sample_posts.map((p: string, i: number) => `${i + 1}. ${p}`).join("\n")}`);
            }
            if (parts.length > 0) {
              brandContext = `\n\nBRAND PROFILE — Match this brand's voice and style:\n${parts.join("\n")}`;
            }
          }
        }
      }
    } catch (e) {
      console.warn("Could not fetch brand profile:", e);
    }

    const toneDescriptions: Record<string, string> = {
      professional: "Professional, authoritative, and polished. Use data-driven insights and industry terminology.",
      charming: "Charming, warm, and personable. Use wit, storytelling, and a friendly conversational style that draws people in.",
      focused: "Focused, concise, and action-oriented. Cut the fluff — deliver sharp, clear value with every sentence.",
      witty: "Witty, clever, and entertaining. Use humor, wordplay, and unexpected angles to make points memorable.",
      inspirational: "Inspirational, motivational, and uplifting. Use powerful language, vision-casting, and emotional hooks.",
      casual: "Casual, relaxed, and approachable. Write like you're talking to a friend — authentic, unfiltered, relatable.",
    };

    const toneInstruction = toneDescriptions[tone] || toneDescriptions.professional;

    const systemPrompt = `You are a social media content expert. Generate bulk content for the given topic.

TONE: ${toneInstruction}
${brandContext}

Return ONLY valid JSON (no markdown fences) with this exact structure:
{
  "linkedin": [array of 10 LinkedIn post strings],
  "twitter": [array of 10 tweet strings (max 280 chars each)],
  "blog": [array of 5 blog title/idea strings]
}

Guidelines:
- LinkedIn posts: Insightful, use emojis sparingly, include hooks and calls to action. Vary formats (listicles, stories, hot takes, data-driven).
- Tweets: Punchy, concise, max 280 chars. Mix threads starters, hot takes, tips, and observations.
- Blog ideas: Compelling titles that would rank well in SEO. Mix guides, case studies, comparisons, and listicles.
- Make each piece unique and high-quality. No filler content.
- Tailor everything specifically to the topic provided.
- IMPORTANT: Maintain the specified tone consistently across ALL content.${brandContext ? "\n- CRITICAL: The content MUST sound like the brand described above. Match their style, terminology, and voice." : ""}`;

    const response = useLovableGateway
      ? await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.0-flash-exp",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Generate bulk social media content about: "${topic}"` },
            ],
            stream: false,
          }),
        })
      : await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GOOGLE_API_KEY}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: systemPrompt },
                  { text: `Generate bulk social media content about: "${topic}"` }
                ]
              }],
              generationConfig: {
                temperature: 0.9,
                topK: 40,
                topP: 0.95,
              }
            }),
          }
        );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please add funds in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const rawContent = useLovableGateway
      ? data.choices?.[0]?.message?.content
      : data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawContent) {
      throw new Error("No content returned from AI");
    }

    const parsed = extractJson(rawContent);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-content error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
