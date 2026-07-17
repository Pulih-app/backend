import { desc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { aiChatMessages } from "../../db/schema";

export type AiChatRecord = { id: string; role: "user" | "assistant"; content: string; createdAt: string };
export type AiPersonaPreferencesRecord = { persona: string; updatedAt: string };

export type AiRepository = {
  createChatMessage(input: { userId: string; role: "user" | "assistant"; content: string }): Promise<{ id: string; userId: string; role: "user" | "assistant"; content: string; createdAt: string }>;
  listChatHistory(userId: string, limit: number): Promise<AiChatRecord[]>;
  getPersonaPreferences(userId: string): Promise<AiPersonaPreferencesRecord | null>;
  upsertPersonaPreferences(input: { userId: string; persona: string }): Promise<AiPersonaPreferencesRecord>;
};

const mapChat = (row: typeof aiChatMessages.$inferSelect): AiChatRecord => ({ id: row.id, role: row.role, content: row.content, createdAt: row.createdAt.toISOString() });

function mapPreferenceRow(row: { persona: string; updatedAt: Date | string }): AiPersonaPreferencesRecord {
  return { persona: row.persona, updatedAt: (row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt)).toISOString() };
}

function asRows(result: unknown): any[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && "rows" in result && Array.isArray((result as { rows?: unknown[] }).rows)) return (result as { rows: unknown[] }).rows as any[];
  return [];
}

async function firstPersonaPreferencesRow(db: NodePgDatabase, userId: string): Promise<AiPersonaPreferencesRecord | null> {
  const queries = [
    sql`SELECT user_id, persona, updated_at FROM ai_persona_preferences WHERE user_id = ${userId} LIMIT 1`,
    sql`SELECT user_id, tone AS persona, updated_at FROM ai_persona_preferences WHERE user_id = ${userId} LIMIT 1`,
    sql`SELECT user_id, persona, updated_at FROM user_ai_persona_preferences WHERE user_id = ${userId} LIMIT 1`,
    sql`SELECT user_id, tone AS persona, updated_at FROM user_ai_persona_preferences WHERE user_id = ${userId} LIMIT 1`,
  ] as const;

  let lastError: unknown = null;
  for (const query of queries) {
    try {
      const rows = asRows(await db.execute(query));
      const row = rows[0];
      return row ? mapPreferenceRow({ persona: row.persona ?? row.tone, updatedAt: row.updated_at }) : null;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to read AI persona preferences");
}

async function upsertPersonaPreferencesRow(db: NodePgDatabase, input: { userId: string; persona: string }): Promise<AiPersonaPreferencesRecord> {
  const now = new Date();
  const statements = [
    sql`INSERT INTO ai_persona_preferences (user_id, persona, updated_at) VALUES (${input.userId}, ${input.persona}, ${now}) ON CONFLICT (user_id) DO UPDATE SET persona = EXCLUDED.persona, updated_at = EXCLUDED.updated_at RETURNING persona, updated_at`,
    sql`INSERT INTO ai_persona_preferences (user_id, tone, updated_at) VALUES (${input.userId}, ${input.persona}, ${now}) ON CONFLICT (user_id) DO UPDATE SET tone = EXCLUDED.tone, updated_at = EXCLUDED.updated_at RETURNING tone AS persona, updated_at`,
    sql`INSERT INTO user_ai_persona_preferences (user_id, persona, updated_at) VALUES (${input.userId}, ${input.persona}, ${now}) ON CONFLICT (user_id) DO UPDATE SET persona = EXCLUDED.persona, updated_at = EXCLUDED.updated_at RETURNING persona, updated_at`,
    sql`INSERT INTO user_ai_persona_preferences (user_id, tone, updated_at) VALUES (${input.userId}, ${input.persona}, ${now}) ON CONFLICT (user_id) DO UPDATE SET tone = EXCLUDED.tone, updated_at = EXCLUDED.updated_at RETURNING tone AS persona, updated_at`,
  ] as const;

  let lastError: unknown = null;
  for (const statement of statements) {
    try {
      const rows = asRows(await db.execute(statement));
      const row = rows[0];
      if (row) return mapPreferenceRow({ persona: row.persona ?? row.tone, updatedAt: row.updated_at });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to save AI persona preferences");
}

export function createAiRepository(db: NodePgDatabase): AiRepository {
  return {
    async createChatMessage(input) {
      const [row] = await db.insert(aiChatMessages).values(input).returning();
      return { ...mapChat(row), userId: row.userId };
    },
    async listChatHistory(userId, limit) {
      const rows = await db.select().from(aiChatMessages).where(eq(aiChatMessages.userId, userId)).orderBy(desc(aiChatMessages.createdAt)).limit(limit);
      return rows.reverse().map(mapChat);
    },
    async getPersonaPreferences(userId) {
      return await firstPersonaPreferencesRow(db, userId);
    },
    async upsertPersonaPreferences(input) {
      return await upsertPersonaPreferencesRow(db, input);
    },
  };
}
