import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RINSE_OFF_NAMES = [
  "Face Wash",
  "Cleanser",
  "Micellar Cleanser",
  "Micellar Water",
  "Cleansing Balm",
  "Makeup Remover",
  "Body Wash",
  "Body Scrub",
  "Hand Wash",
  "Shampoo",
  "Conditioner",
  "Hair Mask",
  "Face Mask",
  "Scalp Scrub",
  "Exfoliant",
  "Exfoliating Scrub",
  "Facial Scrub",
  "Clay Mask",
  "Rinse-Off Mask",
];

async function run() {
  // Verify the column exists before running DML
  const { error: checkErr } = await supabase
    .from("product_types")
    .select("is_rinse_off")
    .limit(1);

  if (checkErr) {
    console.error(
      "✗ Column is_rinse_off not found. Apply the SQL migration first:\n" +
      "  supabase/migrations/20260527_add_rinse_off.sql\n" +
      "  (run it in the Supabase Dashboard → SQL Editor)\n",
      checkErr.message
    );
    process.exit(1);
  }

  console.log("✓ Column is_rinse_off exists");

  const { error } = await supabase
    .from("product_types")
    .update({ is_rinse_off: true })
    .in("name", RINSE_OFF_NAMES);

  if (error) console.error("✗ Set rinse-off defaults:", error.message);
  else console.log(`✓ Set is_rinse_off = true for ${RINSE_OFF_NAMES.length} type names`);

  // Verify
  const { data } = await supabase
    .from("product_types")
    .select("name, body_area, is_rinse_off")
    .order("body_area")
    .order("name");

  console.log("\nFinal product_types table:");
  let lastArea = "";
  for (const row of data ?? []) {
    if (row.body_area !== lastArea) {
      console.log(`\n  [${row.body_area}]`);
      lastArea = row.body_area;
    }
    const tag = row.is_rinse_off ? " [rinse-off]" : "";
    console.log(`    ${row.name}${tag}`);
  }
}

run().catch(console.error);
