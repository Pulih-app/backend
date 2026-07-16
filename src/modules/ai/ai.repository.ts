import { asc, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { aiChatMessages, aiPersonaPreferences } from "../../db/schema";

export type AiChatRecord = { id: string; role: "user" | "assistant"; content: string; createdAt: string };
export type AiPersonaPreferencesRecord = { persona: string; updatedAt: string };

export type AiRepository = {
  createChatMessage(input: { userId: string; role: "user" | "assistant"; content: string }): Promise<{ id: string; userId: string; role: "user" | "assistant"; content: string; createdAt: string }>;
  listChatHistory(userId: string, limit: number): Promise<AiChatRecord[]>;
  getPersonaPreferences(userId: string): Promise<AiPersonaPreferencesRecord | null>;
  upsertPersonaPreferences(input: { userId: string; persona: string }): Promise<AiPersonaPreferencesRecord>;
};

const mapChat = (row: typeof aiChatMessages.$inferSelect): AiChatRecord => ({ id: row.id, role: row.role, content: row.content, createdAt: row.createdAt.toISOString() });
const mapPreferences = (row: typeof aiPersonaPreferences.$inferSelect): AiPersonaPreferencesRecord => ({ persona: row.persona, updatedAt: row.updatedAt.toISOString() });

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
      const [row] = await db.select().from(aiPersonaPreferences).where(eq(aiPersonaPreferences.userId, userId)).limit(1);
      return row ? mapPreferences(row) : null;
    },
    async upsertPersonaPreferences(input) {
      const [row] = await db.insert(aiPersonaPreferences)
        .values({ userId: input.userId, persona: input.persona as any })
        .onConflictDoUpdate({ target: aiPersonaPreferences.userId, set: { persona: input.persona as any, updatedAt: new Date() } })
        .returning();
      return mapPreferences(row);
    },
  };
}
