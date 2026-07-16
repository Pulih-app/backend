import { asc, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { aiChatMessages, aiPersonaPreferences } from "../../db/schema";

export type AiChatRecord = { id: string; userId: string; role: "user" | "assistant"; content: string; createdAt: string };
export type AiPersonaPreferencesRecord = { userId: string; tone: "gentle" | "direct" | "balanced"; focusAreas: string[]; updatedAt: string };

export type AiRepository = {
  createChatMessage(input: { userId: string; role: "user" | "assistant"; content: string }): Promise<AiChatRecord>;
  listChatHistory(userId: string, limit: number): Promise<AiChatRecord[]>;
  getPersonaPreferences(userId: string): Promise<AiPersonaPreferencesRecord | null>;
  upsertPersonaPreferences(input: { userId: string; tone: "gentle" | "direct" | "balanced"; focusAreas: string[] }): Promise<AiPersonaPreferencesRecord>;
};

const mapChat = (row: typeof aiChatMessages.$inferSelect): AiChatRecord => ({ id: row.id, userId: row.userId, role: row.role, content: row.content, createdAt: row.createdAt.toISOString() });
const mapPreferences = (row: typeof aiPersonaPreferences.$inferSelect): AiPersonaPreferencesRecord => ({ userId: row.userId, tone: row.tone, focusAreas: row.focusAreas, updatedAt: row.updatedAt.toISOString() });

export function createAiRepository(db: NodePgDatabase): AiRepository {
  return {
    async createChatMessage(input) {
      const [row] = await db.insert(aiChatMessages).values(input).returning();
      return mapChat(row);
    },
    async listChatHistory(userId, limit) {
      const rows = await db.select().from(aiChatMessages).where(eq(aiChatMessages.userId, userId)).orderBy(desc(aiChatMessages.createdAt)).limit(limit);
      return rows.reverse().map(mapChat);
    },
    async getPersonaPreferences(userId) {
      const [row] = await db.select().from(aiPersonaPreferences).where(eq(aiPersonaPreferences.userId, userId)).limit(1);
      return row ? mapPreferences(row) : null;
    },
    async upsertPersonaPreferences(input) {
      const [row] = await db.insert(aiPersonaPreferences)
        .values(input)
        .onConflictDoUpdate({ target: aiPersonaPreferences.userId, set: { tone: input.tone, focusAreas: input.focusAreas, updatedAt: new Date() } })
        .returning();
      return mapPreferences(row);
    },
  };
}
