import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Use user's auth context
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, posts } = await req.json();

    if (action === "embed") {
      // posts: Array<{ tone, topic, style_tags, post, platform }>
      if (!posts || !Array.isArray(posts) || posts.length === 0) {
        return new Response(JSON.stringify({ error: "posts array required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const results = [];

      for (const p of posts) {
        const { tone = "", topic = "", style_tags = [], post = "", platform = "twitter" } = p;
        if (!post.trim()) continue;

        const combined_text = `${tone} ${topic} ${style_tags.join(" ")} ${post}`;

        // Generate embedding via Lovable AI Gateway (OpenAI-compatible)
        const embResponse = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/text-embedding-3-small",
            input: combined_text,
          }),
        });

        if (!embResponse.ok) {
          const errText = await embResponse.text();
          console.error("Embedding API error:", embResponse.status, errText);
          if (embResponse.status === 429) {
            return new Response(JSON.stringify({ error: "Rate limited. Please try again." }), {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          throw new Error(`Embedding API error: ${embResponse.status}`);
        }

        const embData = await embResponse.json();
        const embedding = embData.data?.[0]?.embedding;

        if (!embedding) throw new Error("No embedding returned from API");

        // Store in Supabase using service role for vector insertion
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const adminClient = createClient(supabaseUrl, serviceKey);

        const { data, error } = await adminClient.from("post_embeddings").insert({
          user_id: user.id,
          tone,
          topic,
          style_tags,
          post,
          platform,
          combined_text,
          embedding: `[${embedding.join(",")}]`,
        }).select("id, tone, topic, post, platform").single();

        if (error) {
          console.error("Insert error:", error);
          throw new Error(`Failed to store embedding: ${error.message}`);
        }

        results.push(data);
      }

      return new Response(JSON.stringify({ success: true, embedded: results.length, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "search") {
      // Search for similar posts given a query
      const { query, tone, platform, match_count = 5 } = await req.json().catch(() => ({}));
      const queryText = posts?.[0]?.post || query || "";
      const toneFilter = posts?.[0]?.tone || tone || null;
      const platformFilter = posts?.[0]?.platform || platform || null;

      if (!queryText) {
        return new Response(JSON.stringify({ error: "query text required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate query embedding
      const embResponse = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/text-embedding-3-small",
          input: `${toneFilter || ""} ${queryText}`,
        }),
      });

      if (!embResponse.ok) throw new Error(`Embedding error: ${embResponse.status}`);
      const embData = await embResponse.json();
      const queryEmbedding = embData.data?.[0]?.embedding;

      // Call match_posts function
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminClient = createClient(supabaseUrl, serviceKey);

      const { data: matches, error } = await adminClient.rpc("match_posts", {
        query_embedding: `[${queryEmbedding.join(",")}]`,
        match_count: match_count,
        filter_tone: toneFilter,
        filter_platform: platformFilter,
      });

      if (error) throw new Error(`Search error: ${error.message}`);

      return new Response(JSON.stringify({ matches }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use 'embed' or 'search'" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("embed-posts error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
