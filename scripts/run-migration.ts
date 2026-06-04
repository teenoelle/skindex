/**
 * Applies a SQL migration file directly to the Supabase database.
 *
 * Usage:
 *   npx tsx scripts/run-migration.ts <path-to-sql-file>
 *
 * Example:
 *   npx tsx scripts/run-migration.ts scripts/migrate-search-misses.sql
 *   npx tsx scripts/run-migration.ts supabase/migrations/20260604_example.sql
 */
import { Client } from "pg";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error("Usage: npx tsx scripts/run-migration.ts <path-to-sql-file>");
  process.exit(1);
}

const sqlPath = path.resolve(process.cwd(), sqlFile);
if (!fs.existsSync(sqlPath)) {
  console.error(`File not found: ${sqlPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, "utf8");
const projectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace("https://", "").split(".")[0];
const password = process.env.SUPABASE_DB_PASSWORD;

if (!projectRef || !password) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_DB_PASSWORD in .env.local");
  process.exit(1);
}

const client = new Client({
  host: `db.${projectRef}.supabase.co`,
  port: 5432,
  database: "postgres",
  user: "postgres",
  password,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log(`Applying: ${path.basename(sqlPath)}`);
  try {
    await client.connect();
    await client.query(sql);
    console.log("✓ Migration applied successfully.");
  } catch (err) {
    console.error("✗ Migration failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
