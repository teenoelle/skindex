import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  async function exec(label: string, fn: () => PromiseLike<{ error: { message?: string } | null }>) {
    const { error } = await fn();
    if (error) console.error(`✗ ${label}:`, error.message ?? String(error));
    else console.log(`✓ ${label}`);
  }

  await exec("Insert Dish Soap (Hands, rinse-off)", () =>
    supabase.from("product_types").upsert(
      { name: "Dish Soap", body_area: "Hands", is_rinse_off: true },
      { onConflict: "name", ignoreDuplicates: true }
    )
  );

  await exec("Insert Laundry Detergent (Home)", () =>
    supabase.from("product_types").upsert(
      { name: "Laundry Detergent", body_area: "Home", is_rinse_off: false },
      { onConflict: "name", ignoreDuplicates: true }
    )
  );

  await exec("Insert Fabric Softener (Home)", () =>
    supabase.from("product_types").upsert(
      { name: "Fabric Softener", body_area: "Home", is_rinse_off: false },
      { onConflict: "name", ignoreDuplicates: true }
    )
  );

  // Verify
  const { data } = await supabase
    .from("product_types")
    .select("name, body_area, is_rinse_off")
    .in("body_area", ["Hands", "Home"])
    .order("body_area")
    .order("name");

  console.log("\nHands + Home product types:");
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
