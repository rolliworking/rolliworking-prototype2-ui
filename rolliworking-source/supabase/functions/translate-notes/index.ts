/**
 * translate-notes – translates an array of inspection note strings
 * from English to a target language using the Lovable AI gateway.
 * Designed for the client-facing approval page.
 */

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { notes, targetLang } = await req.json();

    if (!Array.isArray(notes) || notes.length === 0) {
      return new Response(JSON.stringify({ translations: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cap at 50 notes per request
    const batch = notes.slice(0, 50);

    const prompt = `You are a professional translator for a luxury watch repair workshop (Rolliworks). Translate the following inspection notes from English to ${targetLang === "es" ? "Spanish" : targetLang}.

RULES:
- Keep dollar amounts, numbers, measurements, and brand names (Rolex, etc.) unchanged.
- Keep reference numbers and part numbers unchanged.
- Translate technical watch terms accurately (e.g., "lug" = "asa", "crown" = "corona", "bezel" = "bisel", "bracelet" = "pulsera", "crystal" = "cristal", "case" = "caja", "dial" = "esfera", "hands" = "manecillas").
- Keep it concise and professional — these are short workshop notes, not prose.
- Return ONLY a JSON array of translated strings in the same order. No explanation.

Input:
${JSON.stringify(batch)}`;

    const resp = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      }),
    });

    if (!resp.ok) {
      console.error("AI gateway error:", resp.status, await resp.text());
      // Fallback: return originals
      return new Response(JSON.stringify({ translations: batch }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content || "[]";

    // Parse the JSON array from the response (strip markdown fences if present)
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    let translations: string[];
    try {
      translations = JSON.parse(cleaned);
      if (!Array.isArray(translations)) throw new Error("Not an array");
    } catch {
      console.error("Failed to parse AI response:", cleaned);
      translations = batch; // fallback to originals
    }

    // Ensure same length
    while (translations.length < batch.length) {
      translations.push(batch[translations.length]);
    }

    return new Response(JSON.stringify({ translations: translations.slice(0, batch.length) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("translate-notes error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
