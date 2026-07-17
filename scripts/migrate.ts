/**
 * Safe migration runner: applies pending SQL files one by one.
 * Avoids drizzle-kit migrate hang issue (observed with v0.31.10 pg driver).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { Client } from "pg";
import { loadConfig } from "../src/shared/config";

function databaseEnv() {
  return {
    APP_NAME: process.env.APP_NAME ?? "pulih-api",
    APP_ENV: process.env.APP_ENV ?? "local",
    NODE_ENV: process.env.NODE_ENV ?? "development",
    PORT: process.env.PORT ?? "3000",
    API_PREFIX: process.env.API_PREFIX ?? "/api/v1",
    APP_URL: process.env.APP_URL ?? "https://pulih-api.salmanabdurrahman.my.id",
    PWA_URL: process.env.PWA_URL ?? "http://localhost:3001",
    DATABASE_URL: process.env.DATABASE_URL ?? requiredEnv("DIRECT_DATABASE_URL"),
    DIRECT_DATABASE_URL: process.env.DIRECT_DATABASE_URL ?? requiredEnv("DATABASE_URL"),
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? "local-demo-only-secret",
    JWT_ACCESS_TTL_SECONDS: process.env.JWT_ACCESS_TTL_SECONDS ?? "86400",
    PASSWORD_HASH_COST: process.env.PASSWORD_HASH_COST ?? "10",
    CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS ?? "http://localhost:3001",
    REQUEST_ID_HEADER: process.env.REQUEST_ID_HEADER ?? "x-request-id",
  };
}

function requiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface MigrationFile {
  idx: number;
  tag: string;
  path: string;
  hash: string;
}

function getJournal(): JournalEntry[] {
  const journalPath = join(import.meta.dir, "../drizzle/meta/_journal.json");
  const raw = JSON.parse(readFileSync(journalPath, "utf8"));
  return raw.entries ?? [];
}

function getMigrationFiles(): MigrationFile[] {
  const drizzleDir = join(import.meta.dir, "../drizzle");
  const files = readdirSync(drizzleDir)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .sort();

  return files.map((file) => {
    const match = file.match(/^(\d{4})_(.+)\.sql$/);
    if (!match) throw new Error(`Unexpected migration file name: ${file}`);
    const idx = parseInt(match[1], 10);
    const tag = match[2];
    const path = join(drizzleDir, file);
    const content = readFileSync(path);
    const hash = createHash("sha256").update(content).digest("hex");
    return { idx, tag, path, hash };
  });
}

async function getAppliedCount(client: Client): Promise<number> {
  try {
    const res = await client.query("SELECT COUNT(*) as count FROM drizzle.__drizzle_migrations");
    return parseInt(res.rows[0].count, 10);
  } catch {
    return 0;
  }
}

async function main() {
  const config = loadConfig(databaseEnv());
  const client = new Client({ connectionString: config.database.directDatabaseUrl || config.database.databaseUrl });
  await client.connect();

  try {
    const journal = getJournal();
    const files = getMigrationFiles();
    const applied = await getAppliedCount(client);

    if (applied >= files.length) {
      console.log("All migrations applied. Nothing to do.");
      return;
    }

    console.log(`Pending: ${files.length - applied} migration(s). Applying one at a time...`);
    await client.query("SELECT setval('drizzle.__drizzle_migrations_id_seq', COALESCE((SELECT MAX(id) FROM drizzle.__drizzle_migrations), 0) + 1, false)");

    for (let i = applied; i < files.length; i++) {
      console.log(`Applying ${files[i].tag}...`);
      const sql = readFileSync(files[i].path, "utf8");
      const statements = sql
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter(Boolean);

      await client.query("BEGIN");
      try {
        for (const statement of statements) {
          await client.query(statement);
        }
        await client.query(
          "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)",
          [files[i].hash, journal.find((entry) => entry.idx === files[i].idx)?.when ?? Date.now()],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
      console.log(`  ✓ ${files[i].tag}`);
    }

    console.log("All migrations applied successfully.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
