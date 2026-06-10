import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { extractIngredientsFromUrlWithStatus } from "@/lib/extract-ingredients";
import { queueIngredients } from "@/lib/queue-ingredients";

export const maxDuration = 300;

const MAX_URLS = 50;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const urls: string[] = Array.isArray(body.urls)
    ? body.urls.map((u: unknown) => String(u).trim()).filter(Boolean).slice(0, MAX_URLS)
    : [];

  if (urls.length === 0) return NextResponse.json({ error: "No URLs provided" }, { status: 400 });

  const batchId = crypto.randomUUID();

  await supabaseAdmin.from("url_import_jobs").insert(
    urls.map((url) => ({ batch_id: batchId, user_id: userId, url }))
  );

  after(async () => {
    for (let idx = 0; idx < urls.length; idx++) {
      const url = urls[idx];
      if (idx > 0) await new Promise((r) => setTimeout(r, 2000));

      await supabaseAdmin
        .from("url_import_jobs")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("batch_id", batchId)
        .eq("url", url);

      try {
        const isIHerb = url.toLowerCase().includes("iherb.com");
        const { product: extracted, httpStatus, fetchError } = await extractIngredientsFromUrlWithStatus(url);

        if (!extracted) {
          let reason = "extraction-failed";
          if (isIHerb) reason = "iherb-blocked";
          else if (httpStatus === 429) reason = "rate-limited";
          else if (httpStatus === 403) reason = "blocked";
          else if (httpStatus && httpStatus >= 400) reason = `http-${httpStatus}`;
          else if (httpStatus === 200) reason = "parse-failed";

          await supabaseAdmin
            .from("url_import_jobs")
            .update({
              status: "failed",
              reason,
              http_status: httpStatus ?? null,
              fetch_error: fetchError ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq("batch_id", batchId)
            .eq("url", url);
          continue;
        }

        const name = (extracted.name ?? "").trim() || url;
        const brand = extracted.brand ?? null;

        const { data: existing } = await supabaseAdmin
          .from("products")
          .select("id, name")
          .ilike("name", name)
          .not("ingredient_list", "is", null)
          .maybeSingle();

        if (existing) {
          await supabaseAdmin
            .from("url_import_jobs")
            .update({
              status: "skipped",
              name: existing.name,
              brand: brand ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq("batch_id", batchId)
            .eq("url", url);
          continue;
        }

        const { data: inserted, error: insertError } = await supabaseAdmin
          .from("products")
          .insert({
            name,
            brand,
            ingredient_list: extracted.ingredients,
            type: extracted.type ?? null,
            source: "url-import",
            source_url: url,
            ...(extracted.iherb_url ? { iherb_url: extracted.iherb_url } : {}),
            ...(extracted.image_url ? { image_url: extracted.image_url } : {}),
          })
          .select("id")
          .single();

        if (insertError) {
          await supabaseAdmin
            .from("url_import_jobs")
            .update({
              status: "failed",
              reason: "db-error",
              fetch_error: insertError.message,
              updated_at: new Date().toISOString(),
            })
            .eq("batch_id", batchId)
            .eq("url", url);
          continue;
        }

        if (inserted && extracted.ingredients) {
          Promise.resolve()
            .then(() => queueIngredients(inserted.id, name, extracted.ingredients!))
            .catch(() => {});
        }

        await supabaseAdmin
          .from("url_import_jobs")
          .update({
            status: "imported",
            name,
            brand: brand ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("batch_id", batchId)
          .eq("url", url);
      } catch (e) {
        const errMsg =
          e instanceof Error
            ? `${e.name}: ${e.message}`
            : typeof e === "string"
            ? e
            : "Unknown error";

        await supabaseAdmin
          .from("url_import_jobs")
          .update({
            status: "failed",
            reason: "error",
            fetch_error: errMsg,
            updated_at: new Date().toISOString(),
          })
          .eq("batch_id", batchId)
          .eq("url", url);
      }
    }
  });

  return NextResponse.json({ batchId });
}
