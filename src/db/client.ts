import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { AppConfig } from "../shared/config";

export type DatabaseSource = {
  databaseUrl?: string;
  directDatabaseUrl?: string;
};

export type DatabaseHandle = {
  pool: Pool;
  db: NodePgDatabase;
  ping: () => Promise<void>;
  close: () => Promise<void>;
};

let sharedPool: Pool | null = null;

export function resolveDatabaseUrl(source: DatabaseSource, config?: AppConfig) {
  return source.databaseUrl ?? source.directDatabaseUrl ?? config?.database.databaseUrl ?? config?.database.directDatabaseUrl;
}

export async function createDatabaseHandle(source: DatabaseSource, config?: AppConfig): Promise<DatabaseHandle> {
  if (!sharedPool) {
    const connectionString = resolveDatabaseUrl(source, config);

    if (!connectionString) {
      throw new Error("Database connection string is required.");
    }

    const poolMax = config?.database.poolMax ?? 10;
    const poolIdleTimeoutMs = config?.database.poolIdleTimeoutMs ?? 30000;
    const ssl = connectionString.includes("sslmode=require") || connectionString.includes("sslmode=verify-full")
      ? { rejectUnauthorized: false }
      : false;

    sharedPool = new Pool({
      connectionString,
      max: poolMax,
      idleTimeoutMillis: poolIdleTimeoutMs,
      ssl,
    });
  }

  return {
    pool: sharedPool,
    db: drizzle(sharedPool),
    ping: async () => {
      await sharedPool!.query("select 1");
    },
    close: async () => {
      // Pool is shared across route modules; only close on process exit.
    },
  };
}
