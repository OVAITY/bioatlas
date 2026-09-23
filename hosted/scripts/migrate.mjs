import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const fullPath = path.join(root, file);
    if (!existsSync(fullPath)) continue;
    for (const line of readFileSync(fullPath, "utf8").split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
      }
    }
  }
}

loadEnv();
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });
const drizzleDir = path.join(root, "drizzle");

try {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(drizzleDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const applied = await sql`SELECT 1 FROM schema_migrations WHERE id = ${file}`;
    if (applied.length) {
      console.log(`skip ${file}`);
      continue;
    }
    const text = await readFile(path.join(drizzleDir, file), "utf8");
    await sql.unsafe(text);
    await sql`INSERT INTO schema_migrations (id) VALUES (${file})`;
    console.log(`applied ${file}`);
  }
} finally {
  await sql.end();
}
