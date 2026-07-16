import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { hashSync } from "bcryptjs";
import { loadConfig } from "../src/shared/config";
import {
  achievements,
  communityPosts,
  dailyChallenges,
  dailyMotivations,
  educationContents,
  profiles,
  psychologistCredentialFiles,
  psychologistPracticePlaces,
  psychologistProfiles,
  psychologistSessionBundles,
  psychologistSessionSlots,
  users,
} from "../src/db/schema";

const DEMO_PASSWORD = "PulihDemo123!";
const DEMO_NOW = new Date("2026-01-15T02:00:00.000Z");
const DEMO_DAY = "2026-01-16";

const ids = {
  patientUser: "11111111-1111-4111-8111-111111111111",
  patientProfile: "11111111-1111-4111-8111-111111111112",
  psychologistUser: "22222222-2222-4222-8222-222222222221",
  psychologistProfile: "22222222-2222-4222-8222-222222222222",
  practicePlace: "22222222-2222-4222-8222-222222222223",
  credentialSipp: "22222222-2222-4222-8222-222222222224",
  credentialIjazah: "22222222-2222-4222-8222-222222222225",
  credentialStr: "22222222-2222-4222-8222-222222222226",
  bundle: "33333333-3333-4333-8333-333333333331",
  slotOne: "33333333-3333-4333-8333-333333333332",
  slotTwo: "33333333-3333-4333-8333-333333333333",
  slotThree: "33333333-3333-4333-8333-333333333334",
  educationOne: "44444444-4444-4444-8444-444444444431",
  educationTwo: "44444444-4444-4444-8444-444444444432",
  achievementOne: "44444444-4444-4444-8444-444444444433",
  achievementTwo: "44444444-4444-4444-8444-444444444434",
  postOne: "44444444-4444-4444-8444-444444444441",
  postTwo: "44444444-4444-4444-8444-444444444442",
} as const;

function requiredEnv(key: string) {
  const value = process.env[key];
  if (!value || value.trim().length === 0) throw new Error(`${key} is required to seed demo data.`);
  return value;
}

function databaseEnv() {
  return {
    APP_NAME: process.env.APP_NAME ?? "pulih-api",
    APP_ENV: process.env.APP_ENV ?? "local",
    NODE_ENV: process.env.NODE_ENV ?? "development",
    PORT: process.env.PORT ?? "3000",
    API_PREFIX: process.env.API_PREFIX ?? "/api/v1",
    APP_URL: process.env.APP_URL ?? "http://localhost:3000",
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

async function main() {
  const config = loadConfig(databaseEnv());
  const client = new Client({ connectionString: config.database.directDatabaseUrl || config.database.databaseUrl });
  await client.connect();

  try {
    const db = drizzle(client);
    const passwordHash = hashSync(DEMO_PASSWORD, config.security.passwordHashCost);

    await db.transaction(async (tx) => {
      await tx.insert(users).values([
        { id: ids.patientUser, email: "patient.demo@pulih.local", passwordHash, role: "patient", status: "active", createdAt: DEMO_NOW, updatedAt: DEMO_NOW },
        { id: ids.psychologistUser, email: "psychologist.demo@pulih.local", passwordHash, role: "psychologist", status: "active", createdAt: DEMO_NOW, updatedAt: DEMO_NOW },
      ]).onConflictDoUpdate({ target: users.email, set: { passwordHash, status: "active", updatedAt: DEMO_NOW } });

      await tx.insert(profiles).values({
        id: ids.patientProfile,
        userId: ids.patientUser,
        displayName: "Demo Patient",
        nickname: "Demo",
        recoveryGoal: "Build a steady recovery routine.",
        checkInTime: "20:00:00",
        onboardingCompletedAt: DEMO_NOW,
        createdAt: DEMO_NOW,
        updatedAt: DEMO_NOW,
      }).onConflictDoUpdate({ target: profiles.userId, set: { displayName: "Demo Patient", nickname: "Demo", recoveryGoal: "Build a steady recovery routine.", checkInTime: "20:00:00", onboardingCompletedAt: DEMO_NOW, updatedAt: DEMO_NOW } });

      await tx.insert(psychologistProfiles).values({
        id: ids.psychologistProfile,
        userId: ids.psychologistUser,
        type: "general",
        consultationChannel: "chat",
        approvalStatus: "approved",
        fullName: "Dr. Maya Pulih",
        licenseNumber: "SIPP-DEMO-001",
        bio: "General psychologist for demo counseling sessions.",
        createdAt: DEMO_NOW,
        updatedAt: DEMO_NOW,
      }).onConflictDoUpdate({ target: psychologistProfiles.userId, set: { type: "general", consultationChannel: "chat", approvalStatus: "approved", fullName: "Dr. Maya Pulih", licenseNumber: "SIPP-DEMO-001", bio: "General psychologist for demo counseling sessions.", updatedAt: DEMO_NOW } });

      await tx.insert(psychologistPracticePlaces).values({ id: ids.practicePlace, profileId: ids.psychologistProfile, name: "Pulih Demo Clinic", address: "Jakarta", isActive: true, createdAt: DEMO_NOW, updatedAt: DEMO_NOW }).onConflictDoNothing();

      await tx.insert(psychologistCredentialFiles).values([
        { id: ids.credentialSipp, profileId: ids.psychologistProfile, documentType: "sipp", objectKey: "demo/psychologist/sipp.pdf", fileName: "sipp-demo.pdf", contentType: "application/pdf", sizeBytes: 128000, createdAt: DEMO_NOW },
        { id: ids.credentialIjazah, profileId: ids.psychologistProfile, documentType: "ijazah", objectKey: "demo/psychologist/ijazah.pdf", fileName: "ijazah-demo.pdf", contentType: "application/pdf", sizeBytes: 128000, createdAt: DEMO_NOW },
        { id: ids.credentialStr, profileId: ids.psychologistProfile, documentType: "str", objectKey: "demo/psychologist/str.pdf", fileName: "str-demo.pdf", contentType: "application/pdf", sizeBytes: 128000, createdAt: DEMO_NOW },
      ]).onConflictDoNothing();

      await tx.insert(psychologistSessionBundles).values({
        id: ids.bundle,
        profileId: ids.psychologistProfile,
        packageName: "Paket 1 Jam",
        packageDurationMinutes: 60,
        priceAmount: "150000.00",
        dateStart: new Date("2026-01-16T00:00:00.000Z"),
        dateEnd: new Date("2026-01-18T00:00:00.000Z"),
        dailyStartTime: "09:00:00",
        dailyEndTime: "10:00:00",
        createdAt: DEMO_NOW,
        updatedAt: DEMO_NOW,
      }).onConflictDoUpdate({ target: psychologistSessionBundles.id, set: { packageName: "Paket 1 Jam", packageDurationMinutes: 60, priceAmount: "150000.00", updatedAt: DEMO_NOW } });

      await tx.insert(psychologistSessionSlots).values([
        { id: ids.slotOne, bundleId: ids.bundle, profileId: ids.psychologistProfile, sessionDate: new Date("2026-01-16T00:00:00.000Z"), startsAt: new Date("2026-01-16T02:00:00.000Z"), endsAt: new Date("2026-01-16T03:00:00.000Z"), status: "available", createdAt: DEMO_NOW, updatedAt: DEMO_NOW },
        { id: ids.slotTwo, bundleId: ids.bundle, profileId: ids.psychologistProfile, sessionDate: new Date("2026-01-17T00:00:00.000Z"), startsAt: new Date("2026-01-17T02:00:00.000Z"), endsAt: new Date("2026-01-17T03:00:00.000Z"), status: "available", createdAt: DEMO_NOW, updatedAt: DEMO_NOW },
        { id: ids.slotThree, bundleId: ids.bundle, profileId: ids.psychologistProfile, sessionDate: new Date("2026-01-18T00:00:00.000Z"), startsAt: new Date("2026-01-18T02:00:00.000Z"), endsAt: new Date("2026-01-18T03:00:00.000Z"), status: "available", createdAt: DEMO_NOW, updatedAt: DEMO_NOW },
      ]).onConflictDoUpdate({ target: psychologistSessionSlots.id, set: { status: "available", heldUntil: null, updatedAt: DEMO_NOW } });

      await tx.insert(educationContents).values([
        { id: ids.educationOne, title: "Understanding Triggers", content: "Notice patterns, plan alternatives, and ask for support early.", category: "recovery", status: "published", publishedAt: DEMO_NOW, createdAt: DEMO_NOW, updatedAt: DEMO_NOW },
        { id: ids.educationTwo, title: "Small Daily Wins", content: "Small consistent actions can strengthen recovery momentum.", category: "routine", status: "published", publishedAt: DEMO_NOW, createdAt: DEMO_NOW, updatedAt: DEMO_NOW },
      ]).onConflictDoNothing();

      await tx.insert(dailyMotivations).values({ content: "One careful choice today is progress.", source: "Pulih", localDate: DEMO_DAY, status: "published", createdAt: DEMO_NOW, updatedAt: DEMO_NOW }).onConflictDoUpdate({ target: dailyMotivations.localDate, set: { content: "One careful choice today is progress.", source: "Pulih", status: "published", updatedAt: DEMO_NOW } });
      await tx.insert(dailyChallenges).values({ title: "Five-minute grounding", description: "Pause, breathe, and name five things you can see.", category: "mindfulness", localDate: DEMO_DAY, status: "published", createdAt: DEMO_NOW, updatedAt: DEMO_NOW }).onConflictDoUpdate({ target: dailyChallenges.localDate, set: { title: "Five-minute grounding", description: "Pause, breathe, and name five things you can see.", category: "mindfulness", status: "published", updatedAt: DEMO_NOW } });

      await tx.insert(achievements).values({
        id: ids.achievementOne,
        key: "first_check_in",
        title: "First Check-in",
        description: "Complete your first daily check-in.",
        criteria: { type: "check_in_count", target: 1 },
        createdAt: DEMO_NOW,
      }).onConflictDoUpdate({ target: achievements.key, set: { title: "First Check-in", description: "Complete your first daily check-in.", criteria: { type: "check_in_count", target: 1 } } });

      await tx.insert(achievements).values({
        id: ids.achievementTwo,
        key: "three_day_streak",
        title: "Three-day Streak",
        description: "Complete check-ins for three days.",
        criteria: { type: "streak", target: 3 },
        createdAt: DEMO_NOW,
      }).onConflictDoUpdate({ target: achievements.key, set: { title: "Three-day Streak", description: "Complete check-ins for three days.", criteria: { type: "streak", target: 3 } } });

      await tx.insert(communityPosts).values([
        { id: ids.postOne, userId: ids.patientUser, category: "support", content: "Today I am choosing one healthier response to stress.", likeCount: 0, commentCount: 0, createdAt: DEMO_NOW, updatedAt: DEMO_NOW },
        { id: ids.postTwo, userId: ids.psychologistUser, category: "general", content: "Reminder: progress is built through small repeatable steps.", likeCount: 0, commentCount: 0, createdAt: DEMO_NOW, updatedAt: DEMO_NOW },
      ]).onConflictDoUpdate({ target: communityPosts.id, set: { likeCount: 0, commentCount: 0, updatedAt: DEMO_NOW } });
    });

    console.log("Demo seed complete.");
    console.log("Patient: patient.demo@pulih.local / PulihDemo123!");
    console.log("Psychologist: psychologist.demo@pulih.local / PulihDemo123!");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
