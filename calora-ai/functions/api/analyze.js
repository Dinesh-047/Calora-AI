// Cloudflare Pages Function: POST /api/analyze
// Requires an AI binding named AI in Cloudflare Pages > Settings > Functions > Workers AI.
// The AI provider/model and quotas can change; test this route after deployment.
export async function onRequestPost({ request, env }) {
  try {
    if (!env.AI) {
      return Response.json({ error: "AI is not configured. In Cloudflare Pages, add a Workers AI binding named AI. You can still add food manually." }, { status: 503 });
    }
    const body = await request.json();
    const image = body?.image;
    if (typeof image !== "string" || !image.startsWith("data:image/") || image.length > 7_000_000) {
      return Response.json({ error: "Please upload a valid image under the supported size limit." }, { status: 400 });
    }
    const prompt = `You are a cautious nutrition estimation assistant. Inspect this food photo and estimate the visible food items and serving sizes. Image-only calorie estimates are uncertain. Return ONLY valid JSON with these fields: name (short meal name), portion (estimated portion and key uncertainty), calories (integer kcal for the visible serving), protein (grams number), carbs (grams number), fat (grams number), confidence ("low", "medium", or "high"), items (array of {name, portion, calories}). Do not claim exact measurements. If the food cannot be identified, say so in name and use conservative rough estimates.`;
    const result = await env.AI.run("@cf/meta/llama-3.2-11b-vision-instruct", {
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: image } }
        ]
      }],
      max_tokens: 500
    });
    let raw = result?.response || result?.result || "";
    if (typeof raw !== "string") raw = JSON.stringify(raw);
    const cleaned = raw.replace(/```json|```/gi, "").trim();
    const start = cleaned.indexOf("{"), end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) {
      return Response.json({ error: "The AI response could not be parsed. Please try again or enter food manually." }, { status: 502 });
    }
    let food;
    try { food = JSON.parse(cleaned.slice(start, end + 1)); }
    catch { return Response.json({ error: "The AI returned an unreadable estimate. Please try again." }, { status: 502 }); }
    const numberOrZero = (v) => Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0;
    return Response.json({
      food: {
        name: String(food.name || "Food estimate").slice(0, 100),
        portion: String(food.portion || "Approximate serving").slice(0, 180),
        calories: Math.round(numberOrZero(food.calories)),
        protein: Math.round(numberOrZero(food.protein) * 10) / 10,
        carbs: Math.round(numberOrZero(food.carbs) * 10) / 10,
        fat: Math.round(numberOrZero(food.fat) * 10) / 10,
        confidence: ["low", "medium", "high"].includes(String(food.confidence).toLowerCase()) ? String(food.confidence).toLowerCase() : "low",
        items: Array.isArray(food.items) ? food.items.slice(0, 12) : []
      }
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: "Food analysis failed. Check the AI binding/model availability and try again." }, { status: 500 });
  }
}
