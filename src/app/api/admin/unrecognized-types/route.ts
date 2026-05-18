import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

const CANONICAL_TYPES = new Set([
  "BB Cream", "Blush", "Body Lotion", "Body Wash", "Brow Gel", "CC Cream",
  "Concealer", "Concentrate", "Conditioner", "Deodorant", "Exfoliant",
  "Eye Cream", "Eye Primer", "Eyeliner", "Eyeshadow", "Face Mask", "Face Wash",
  "Foot Cream", "Foundation", "Hair Treatment", "Hand Cream", "Lip Balm",
  "Lip Treatment", "Makeup Remover", "Mascara", "Mist", "Moisturizer", "Oil",
  "Ointment", "Primer", "Scalp Treatment", "Serum", "Setting Spray", "Shampoo",
  "Sleeping Mask", "Spot Patches", "Sun Screen", "Toner",
]);

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: user } = await supabase
    .from("app_users").select("role").eq("clerk_id", userId).maybeSingle();
  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id, name, brand, type, image_url, iherb_url, source")
    .not("type", "is", null)
    .order("name")
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const unrecognized = (data ?? []).filter((p) => p.type && !CANONICAL_TYPES.has(p.type));
  return NextResponse.json({ products: unrecognized });
}
