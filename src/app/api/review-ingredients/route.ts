import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();
const BATCH_SIZE = 20;

async function processQueue(): Promise<NextResponse> {
  const { data: queue, error } = await supabaseAdmin
    .from("ingredient_queue")
    .select("id, name")
    .order("times_seen", { ascending: false })
    .limit(BATCH_SIZE);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!queue?.length) return NextResponse.json({ reviewed: 0, message: "No ingredients queued" });

  let reviewed = 0;

  for (const item of queue) {
    try {
      const msg = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: `You are a skincare ingredient safety expert. Analyze the ingredient "${item.name}" for someone with reactive/sensitive skin.

Respond in this exact JSON format (no markdown, no code blocks):
{"status":"safe","explanation":"..."}

Use "flagged" for ingredients that commonly cause irritation, allergic reactions, or sensitization in reactive skin. Use "safe" for ingredients that are generally well-tolerated. Keep the explanation to 1–2 sentences.`,
          },
        ],
      });

      const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : null;
      if (!text) continue;

      const parsed = JSON.parse(text) as { status: string; explanation: string };
      if (parsed.status !== "safe" && parsed.status !== "flagged") continue;

      // Check if already in ingredients table
      const { data: existing } = await supabaseAdmin
        .from("ingredients")
        .select("id")
        .ilike("name", item.name)
        .maybeSingle();

      if (!existing) {
        const { error: insertErr } = await supabaseAdmin.from("ingredients").insert({
          name: item.name,
          status: parsed.status,
          explanation: parsed.explanation,
        });
        if (insertErr) continue;
      }

      await supabaseAdmin.from("ingredient_queue").delete().eq("id", item.id);
      reviewed++;
    } catch {
      // skip bad parses or API errors
    }
  }

  return NextResponse.json({ reviewed, total: queue.length });
}

export async function GET() {
  return processQueue();
}

export async function POST() {
  return processQueue();
}
