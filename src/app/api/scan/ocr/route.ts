import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic";

export async function POST(req: NextRequest) {
  const body = await req.json() as { image?: string };
  if (!body.image) return NextResponse.json({ error: "No image" }, { status: 400 });

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: body.image },
            },
            {
              type: "text",
              text: "This is a photo of a skincare or cosmetic product's ingredient label. Extract the complete ingredient list exactly as printed. Return ONLY the ingredient names as a comma-separated list, preserving any parenthetical INCI names. Do not add any explanation, headers, or formatting — just the raw ingredient list.",
            },
          ],
        },
      ],
    });

    const block = msg.content.find((b) => b.type === "text");
    const text = block && block.type === "text" ? block.text.trim() : "";
    if (!text) return NextResponse.json({ error: "No text could be extracted from the image." });

    return NextResponse.json({ ingredients: text });
  } catch {
    return NextResponse.json({ error: "Extraction failed. Try again." }, { status: 500 });
  }
}
