import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { users } from "../../db/schema";
import type { AuthUser, UserRole } from "./auth.types";

export type AuthUserRecord = AuthUser & {
  passwordHash: string;
};

export type AuthRepository = {
  createPatient(input: { email: string; passwordHash: string }): Promise<AuthUserRecord>;
  findByEmail(email: string): Promise<AuthUserRecord | null>;
  findById(id: string): Promise<AuthUserRecord | null>;
};

function mapUser(row: typeof users.$inferSelect): AuthUserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    role: row.role as UserRole,
    status: row.status,
  };
}

export function createAuthRepository(db: NodePgDatabase): AuthRepository {
  return {
    async createPatient(input) {
      const [row] = await db.insert(users).values({
        email: input.email,
        passwordHash: input.passwordHash,
        role: "patient",
      }).returning();

      return mapUser(row);
    },
    async findByEmail(email) {
      const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      return row ? mapUser(row) : null;
    },
    async findById(id) {
      const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return row ? mapUser(row) : null;
    },
  };
}
