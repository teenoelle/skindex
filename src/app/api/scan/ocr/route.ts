import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic";

const PROMPTS = {
  ingredients:
    "This is a photo of a skincare or cosmetic product's ingredient label. The text may be partially angled or curved — extract as much as you can read. Return ONLY the ingredient names as a comma-separated list, preserving any parenthetical INCI names. No explanation, headers, or formatting — just the raw ingredient list.",
  product:
    "This is a photo of a skincare or cosmetic product. Read the product name and brand from the packaging. Return ONLY a single search string combining brand and product name exactly as they appear (e.g. 'CeraVe Moisturizing Cream'). If you cannot read the brand, return just the product name. Nothing else — no explanation, no punctuation.",
};

export async function POST(req: NextRequest) {
  const body = await req.json() as { image?: string; mode?: string };
  if (!body.image) return NextResponse.json({ error: "No image" }, { status: 400 });

  const mode = body.mode === "product" ? "product" : "ingredients";

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Image scanning requires an Anthropic API key — add ANTHROPIC_API_KEY to your environment." },
      { status: 503 }
    );
  }

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: body.image } },
            { type: "text", text: PROMPTS[mode] },
          ],
        },
      ],
    });

    const block = msg.content.find((b) => b.type === "text");
    const text = block && block.type === "text" ? block.text.trim() : "";
    if (!text) return NextResponse.json({ error: "No text could be extracted from the image." });

    if (mode === "product") return NextResponse.json({ name: text });
    return NextResponse.json({ ingredients: text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[OCR] Extraction failed:", msg);
    if (msg.includes("401") || msg.toLowerCase().includes("authentication") || msg.toLowerCase().includes("api key")) {
      return NextResponse.json({ error: "API authentication failed — check ANTHROPIC_API_KEY." }, { status: 503 });
    }
    return NextResponse.json({ error: "Extraction failed. Try again." }, { status: 500 });
  }
}
