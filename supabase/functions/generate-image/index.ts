import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { topic, content, contentId } = await req.json();
    if (!topic || !contentId) {
      return new Response(
        JSON.stringify({ error: "topic and contentId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try Lovable Gateway first (supports image generation), fallback to Google API
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    
    if (!LOVABLE_API_KEY && !GOOGLE_API_KEY) {
      throw new Error("Either LOVABLE_API_KEY or GOOGLE_API_KEY must be configured");
    }
    
    const useLovableGateway = !!LOVABLE_API_KEY;

    const prompt = `Create a professional, modern, visually striking social media visual for a LinkedIn post about: "${topic}". ${content ? `The post says: "${content.substring(0, 200)}"` : ''} Style: clean, corporate-friendly, high contrast, suitable as a LinkedIn featured image. No text overlay. Abstract or conceptual illustration.`;

    const response = useLovableGateway
      ? await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.0-flash-exp",
            messages: [{ role: "user", content: prompt }],
            modalities: ["image", "text"],
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
                parts: [{ text: prompt }]
              }],
              generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
              }
            }),
          }
        );

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
      console.error("Image generation error:", response.status, text);
      throw new Error(`Image generation error: ${response.status}`);
    }

    const data = await response.json();
    
    let imageUrl: string;
    
    if (useLovableGateway) {
      // Lovable Gateway supports image generation
      imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!imageUrl) {
        // Fallback to SVG placeholder if no image returned
        imageUrl = "data:image/svg+xml;base64," + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#0077b5"/><text x="50%" y="50%" text-anchor="middle" fill="white" font-size="48" font-family="Arial">${topic}</text></svg>`);
      }
    } else {
      // Google API doesn't support image generation directly, use placeholder
      imageUrl = "data:image/svg+xml;base64," + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#0077b5"/><text x="50%" y="50%" text-anchor="middle" fill="white" font-size="48" font-family="Arial">${topic}</text></svg>`);
    }

    // Upload to storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Decode base64 and upload
    const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, "");
    const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    const filePath = `generated/${contentId}.png`;
    const { error: uploadError } = await sb.storage
      .from("content-images")
      .upload(filePath, imageBytes, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      // Fall back to returning inline base64
      return new Response(
        JSON.stringify({ image_url: imageUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: publicUrlData } = sb.storage
      .from("content-images")
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    // Update content record with image URL
    await sb
      .from("generated_content")
      .update({ image_url: publicUrl })
      .eq("id", contentId);

    return new Response(
      JSON.stringify({ image_url: publicUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
