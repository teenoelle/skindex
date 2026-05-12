import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { anthropic } from "@/lib/anthropic";

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

async function extractFromUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();
    const text = stripHtml(html);

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Extract the skincare product ingredients list from the following web page text. Return ONLY the ingredients as a comma-separated list (like "Water, Glycerin, Niacinamide"). Do not include any other text, labels, or commentary. If no ingredients list is found, return exactly: NONE\n\n${text}`,
        },
      ],
    });

    const result = message.content[0].type === "text" ? message.content[0].text.trim() : null;
    if (!result || result.toUpperCase() === "NONE") return null;
    return result;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to add products" }, { status: 401 });
  }

  const { name, brand, type, ingredient_list, url } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Product name is required" }, { status: 400 });
  }

  const hasIngredients = !!ingredient_list?.trim();
  const hasUrl = !!url?.trim();

  if (!hasIngredients && !hasUrl) {
    return NextResponse.json({ error: "Provide an ingredient list or a product URL" }, { status: 400 });
  }

  let ingredientText: string | null = ingredient_list?.trim() ?? null;

  if (!ingredientText && hasUrl) {
    const today = new Date().toISOString().split("T")[0];
    const { data: appUser } = await supabase
      .from("app_users")
      .select("ai_extractions_today, last_reset_date, role")
      .eq("clerk_id", userId)
      .maybeSingle();

    const extractions = appUser?.last_reset_date === today ? (appUser?.ai_extractions_today ?? 0) : 0;
    if (appUser?.role !== "admin" && extractions >= 5) {
      return NextResponse.json(
        { error: "Daily URL extraction limit reached. Paste the ingredient list instead." },
        { status: 429 }
      );
    }

    ingredientText = await extractFromUrl(url.trim());
    if (!ingredientText) {
      return NextResponse.json(
        { error: "Could not extract ingredients from that URL. Try pasting the ingredient list instead." },
        { status: 400 }
      );
    }

    if (appUser?.role !== "admin") {
      await supabase
        .from("app_users")
        .upsert(
          { clerk_id: userId, ai_extractions_today: extractions + 1, last_reset_date: today },
          { onConflict: "clerk_id" }
        );
    }
  }

  // Deduplicate by exact name (case-insensitive)
  const { data: existing } = await supabase
    .from("products")
    .select("id")
    .ilike("name", name.trim())
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "A product with this name already exists.", productId: existing.id },
      { status: 409 }
    );
  }

  const { data: inserted, error } = await supabaseAdmin
    .from("products")
    .insert({
      name: name.trim(),
      brand: brand?.trim() || null,
      type: type?.trim() || null,
      ingredient_list: ingredientText,
      submitted_by: userId,
      submitted_at: new Date().toISOString(),
      source: "community",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ productId: inserted.id });
}
