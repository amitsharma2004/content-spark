import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    const body = await req.json();
    const { action, posts } = body;

    if (action === "embed") {
      if (!posts || !Array.isArray(posts) || posts.length === 0) {
        return new Response(JSON.stringify({ error: "posts array required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminClient = createClient(supabaseUrl, serviceKey);
      const results = [];

      for (const p of posts) {
        const { tone = "", topic = "", style_tags = [], post = "", platform = "twitter" } = p;
        if (!post.trim()) continue;

        const combined_text = `${tone} ${topic} ${style_tags.join(" ")} ${post}`;

        const { data, error } = await adminClient.from("post_embeddings").insert({
          user_id: user.id,
          tone,
          topic,
          style_tags,
          post,
          platform,
          combined_text,
        }).select("id, tone, topic, post, platform").single();

        if (error) {
          console.error("Insert error:", error);
          throw new Error(`Failed to store post: ${error.message}`);
        }
        results.push(data);
      }

      return new Response(JSON.stringify({ success: true, embedded: results.length, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "search") {
      const query = body.query || posts?.[0]?.post || "";
      const tone = body.tone || posts?.[0]?.tone || null;
      const platform = body.platform || posts?.[0]?.platform || null;
      const match_count = body.match_count || 5;

      if (!query) {
        return new Response(JSON.stringify({ error: "query text required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminClient = createClient(supabaseUrl, serviceKey);

      const { data: matches, error } = await adminClient.rpc("match_posts", {
        query_text: `${tone || ""} ${query}`,
        match_count,
        filter_tone: tone,
        filter_platform: platform,
      });

      if (error) throw new Error(`Search error: ${error.message}`);

      return new Response(JSON.stringify({ matches: matches || [] }), {
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
