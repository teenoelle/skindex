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

  await exec("Fix Lips → Lip typo", () =>
    supabase.from("product_types").update({ body_area: "Lip" }).eq("body_area", "Lips")
  );
  await exec("Rename Sun Screen → Sunscreen Face", () =>
    supabase.from("product_types").update({ name: "Sunscreen Face" }).eq("name", "Sun Screen")
  );
  await exec("Move Hand Cream to Hands body area", () =>
    supabase.from("product_types").update({ body_area: "Hands" }).eq("name", "Hand Cream")
  );
  await exec("Insert new product types", () =>
    supabase.from("product_types").upsert(
      [
        { name: "Neck Cream",      body_area: "Face"  },
        { name: "Body Oil",        body_area: "Body"  },
        { name: "Body Serum",      body_area: "Body"  },
        { name: "Sunscreen Body",  body_area: "Body"  },
        { name: "Hand Sanitizer",  body_area: "Hands" },
        { name: "Lip Scrub",       body_area: "Lip"   },
        { name: "Sunscreen Lip",   body_area: "Lip"   },
        { name: "Nail Treatment",  body_area: "Nails" },
        { name: "Nail Polish",     body_area: "Nails" },
        { name: "Dry Shampoo",     body_area: "Hair"  },
      ],
      { onConflict: "name", ignoreDuplicates: true }
    )
  );

  // Verify final state
  const { data } = await supabase
    .from("product_types")
    .select("name, body_area")
    .order("body_area")
    .order("name");

  console.log("\nFinal product_types table:");
  let lastArea = "";
  for (const row of data ?? []) {
    if (row.body_area !== lastArea) {
      console.log(`\n  [${row.body_area}]`);
      lastArea = row.body_area;
    }
    console.log(`    ${row.name}`);
  }
}

run().catch(console.error);
