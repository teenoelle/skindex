// Migrates old product type names to merged equivalents.
// Run with: npx ts-node scripts/migrate-product-types.ts

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const [k, ...v] = line.split("=");
  if (k && !k.startsWith("#")) process.env[k.trim()] = v.join("=").trim();
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TYPE_MAP: Record<string, string> = {
  "Hair Mask": "Hair Treatment",
  "Hair Serum": "Hair Treatment",
  "Hair Oil": "Hair Treatment",
  "Scalp Serum": "Scalp Treatment",
};

async function run() {
  for (const [oldType, newType] of Object.entries(TYPE_MAP)) {
    const { data, error } = await supabase
      .from("products")
      .update({ type: newType })
      .eq("type", oldType)
      .select("id");

    if (error) {
      console.error(`Failed to migrate "${oldType}":`, error.message);
    } else {
      console.log(`"${oldType}" → "${newType}": ${data?.length ?? 0} products updated`);
    }
  }
  console.log("Done.");
}

run();
