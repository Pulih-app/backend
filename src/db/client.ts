import { Client } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { AppConfig } from "../shared/config";

export type HyperdriveLike = {
  connectionString: string;
};

export type DatabaseSource = {
  hyperdrive?: HyperdriveLike;
  databaseUrl?: string;
  directDatabaseUrl?: string;
};

export type DatabaseHandle = {
  client: Client;
  db: NodePgDatabase;
  ping: () => Promise<void>;
  close: () => Promise<void>;
};

export function resolveDatabaseUrl(source: DatabaseSource, config?: AppConfig) {
  return source.hyperdrive?.connectionString ?? source.directDatabaseUrl ?? source.databaseUrl ?? config?.database.directDatabaseUrl ?? config?.database.databaseUrl;
}

export async function createDatabaseHandle(source: DatabaseSource, config?: AppConfig): Promise<DatabaseHandle> {
  const connectionString = resolveDatabaseUrl(source, config);

  if (!connectionString) {
    throw new Error("Database connection string is required.");
  }

  const client = new Client({ connectionString });
  await client.connect();

  return {
    client,
    db: drizzle(client),
    ping: async () => {
      await client.query("select 1");
    },
    close: async () => {
      await client.end();
    },
  };
}
