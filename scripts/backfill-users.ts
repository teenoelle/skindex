/**
 * One-time backfill: syncs all Clerk users into the `users` table.
 * Run once after the users table migration is applied.
 *
 * Usage: npx tsx scripts/backfill-users.ts
 */

import { createClient } from "@supabase/supabase-js";
import { createClerkClient } from "@clerk/backend";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? (() => { throw new Error("NEXT_PUBLIC_SUPABASE_URL not set"); })(),
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? (() => { throw new Error("SUPABASE_SERVICE_ROLE_KEY not set"); })(),
);

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY ?? (() => { throw new Error("CLERK_SECRET_KEY not set"); })(),
});

async function main() {
  console.log("\nBackfill: Clerk → users table\n");

  let offset = 0;
  const pageSize = 500;
  let total = 0;
  let errors = 0;

  while (true) {
    const page = await clerk.users.getUserList({ limit: pageSize, offset, orderBy: "-created_at" });
    if (!page.data.length) break;

    const rows = page.data.map((u) => ({
      clerk_id: u.id,
      email: u.emailAddresses?.[0]?.emailAddress ?? null,
      name: [u.firstName, u.lastName].filter(Boolean).join(" ") || null,
      image_url: u.imageUrl ?? null,
      created_at: u.createdAt ? new Date(u.createdAt).toISOString() : null,
      last_sign_in_at: u.lastSignInAt ? new Date(u.lastSignInAt).toISOString() : null,
      synced_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("users").upsert(rows, { onConflict: "clerk_id" });
    if (error) {
      console.error(`  ✗ batch at offset ${offset}: ${error.message}`);
      errors++;
    } else {
      console.log(`  ✓ upserted ${rows.length} users (offset ${offset})`);
      total += rows.length;
    }

    if (page.data.length < pageSize) break;
    offset += pageSize;
  }

  console.log(`\nDone. ${total} users synced, ${errors} error(s).\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
