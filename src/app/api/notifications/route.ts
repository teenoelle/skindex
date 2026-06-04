import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function productPath(name: string, brand: string | null, id: string): string {
  const parts = [brand, name].filter(Boolean).join(" ");
  return `/product/${slugify(parts)}-${id}`;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [submissionsRes, flagsRes] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("id, name, brand, is_pending, submitted_at, reviewed_at")
      .eq("submitted_by", userId)
      .eq("is_archived", false)
      .order("submitted_at", { ascending: false })
      .limit(50),

    supabaseAdmin
      .from("ingredient_flags")
      .select("id, ingredient_id, reasons, reason, product_id, reviewed_at, review_action, created_at, ingredients(id, name), products(id, name, brand)")
      .eq("flagged_by_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const submissions = (submissionsRes.data ?? []).map((p) => ({
    type: "submission" as const,
    id: p.id,
    productName: p.name,
    productBrand: p.brand ?? null,
    status: p.is_pending ? "pending" : "approved",
    submittedAt: p.submitted_at,
    productPath: !p.is_pending ? productPath(p.name, p.brand, p.id) : null,
  }));

  type FlagRow = {
    id: string;
    ingredient_id: string;
    reasons: string[] | null;
    reason: string | null;
    product_id: string | null;
    reviewed_at: string | null;
    review_action: string | null;
    created_at: string;
    ingredients: { id: string; name: string } | null;
    products: { id: string; name: string; brand: string | null } | null;
  };

  const flags = ((flagsRes.data ?? []) as unknown as FlagRow[]).map((f) => {
    const userReasons = f.reasons?.length ? f.reasons : f.reason ? [f.reason] : [];
    const product = f.products;
    return {
      type: "flag" as const,
      id: f.id,
      ingredientName: f.ingredients?.name ?? "Unknown ingredient",
      reasons: userReasons,
      status: f.reviewed_at
        ? f.review_action === "dismiss" ? "dismissed" : "addressed"
        : "pending",
      reviewAction: f.review_action ?? null,
      flaggedAt: f.created_at,
      reviewedAt: f.reviewed_at ?? null,
      productPath: product ? productPath(product.name, product.brand, product.id) : null,
      productName: product?.name ?? null,
    };
  });

  // Badge count: resolved items from the last 30 days
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const newCount =
    submissions.filter((s) => s.status === "approved" && s.submittedAt && s.submittedAt > cutoff).length +
    flags.filter((f) => f.status !== "pending" && f.reviewedAt && f.reviewedAt > cutoff).length;

  return NextResponse.json({ submissions, flags, newCount });
}
