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

    // Try Stability AI API (generates image), Groq API (generates SVG placeholder), Lovable Gateway (generates image), or Google API (generates SVG placeholder)
    const STABILITY_API_KEY = Deno.env.get("STABILITY_API_KEY");
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    
    if (!STABILITY_API_KEY && !GROQ_API_KEY && !LOVABLE_API_KEY && !GOOGLE_API_KEY) {
      throw new Error("Neither STABILITY_API_KEY, GROQ_API_KEY, LOVABLE_API_KEY, nor GOOGLE_API_KEY is configured");
    }

    let imageUrl: string;

    if (STABILITY_API_KEY) {
      const prompt = `Create a professional, modern, visually striking social media visual for a LinkedIn post about: "${topic}". ${content ? `The post says: "${content.substring(0, 200)}"` : ''} Style: clean, corporate-friendly, high contrast, suitable as a LinkedIn featured image. No text overlay. Abstract or conceptual illustration.`;
      
      const response = await fetch("https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${STABILITY_API_KEY}`,
        },
        body: JSON.stringify({
          text_prompts: [
            {
              text: prompt,
              weight: 1
            }
          ],
          cfg_scale: 7,
          height: 1024,
          width: 1024,
          steps: 30,
          samples: 1
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Stability AI error:", response.status, errorText);
        throw new Error(`Stability AI generation failed: ${response.status}`);
      }

      const responseJSON = await response.json();
      const base64Image = responseJSON.artifacts?.[0]?.base64;
      if (!base64Image) {
        throw new Error("No image data returned from Stability AI");
      }
      imageUrl = `data:image/png;base64,${base64Image}`;
    } else if (GROQ_API_KEY) {
      // Groq does not do image generation, use placeholder SVG
      imageUrl = "data:image/svg+xml;base64," + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#0077b5"/><text x="50%" y="50%" text-anchor="middle" fill="white" font-size="48" font-family="Arial">${topic}</text></svg>`);
    } else {
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
              model: "google/gemini-3-pro-image-preview",
              messages: [{ role: "user", content: prompt }],
              modalities: ["image", "text"],
            }),
          })
        : await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
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
      if (useLovableGateway) {
        imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      }
      
      if (!imageUrl) {
        imageUrl = "data:image/svg+xml;base64," + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#0077b5"/><text x="50%" y="50%" text-anchor="middle" fill="white" font-size="48" font-family="Arial">${topic}</text></svg>`);
      }
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
