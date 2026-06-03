/**
 * Fetches all items from ingredient_queue for Claude Code to classify and explain.
 *
 * Usage:
 *   npx tsx scripts/fetch-queue.ts
 *
 * Output: JSON array of { id, name, times_seen, found_in }
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const limit = parseInt(process.argv.find((a) => /^\d+$/.test(a)) ?? "9999");

async function main() {
  const { data, error } = await supabase
    .from("ingredient_queue")
    .select("id, name, times_seen, found_in")
    .order("times_seen", { ascending: false })
    .limit(limit);

  if (error) { process.stderr.write("ERROR: " + JSON.stringify(error) + "\n"); process.exit(1); }
  process.stdout.write(JSON.stringify(data ?? [], null, 2) + "\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
