import { hashSync } from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, inArray, sql } from "drizzle-orm";
import { Client } from "pg";
import { loadConfig } from "../src/shared/config";
import {
  achievements,
  bookingReviews,
  bookings,
  communityComments,
  communityPostLikes,
  communityPosts,
  dailyChallenges,
  dailyMotivations,
  dailyPhysicalChallenges,
  educationContents,
  profiles,
  psychologistCredentialFiles,
  psychologistPracticePlaces,
  psychologistProfiles,
  psychologistSessionBundles,
  psychologistSessionSlots,
  users,
} from "../src/db/schema";
import {
  DEMO_IDS,
  DEMO_NOW,
  DEMO_PASSWORD,
  demoAchievements,
  demoBookingReviews,
  demoBookings,
  demoCommunityComments,
  demoCommunityLikes,
  demoCommunityPosts,
  demoCredentialFiles,
  demoDailyChallenges,
  demoDailyMotivations,
  demoEducationContents,
  demoPhysicalChallenges,
  demoProfiles,
  demoPsychologistProfiles,
  demoPracticePlaces,
  demoSessionBundles,
  demoSessionSlots,
  demoUsers,
} from "./seed-demo-data";

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

async function main() {
  const config = loadConfig(databaseEnv());
  const client = new Client({ connectionString: config.database.directDatabaseUrl || config.database.databaseUrl });
  await client.connect();

  try {
    const db = drizzle(client);
    const passwordHash = hashSync(DEMO_PASSWORD, config.security.passwordHashCost);

    await db.transaction(async (tx) => {
      await tx.delete(communityPostLikes).where(
        and(
          inArray(communityPostLikes.postId, DEMO_IDS.posts),
          inArray(communityPostLikes.userId, demoCommunityLikes.map((item) => item.userId)),
        ),
      );
      await tx.delete(communityComments).where(inArray(communityComments.id, DEMO_IDS.comments));
      await tx.delete(communityPosts).where(inArray(communityPosts.id, DEMO_IDS.posts));
      await tx.delete(achievements).where(inArray(achievements.id, DEMO_IDS.achievements));
      await tx.delete(dailyChallenges).where(inArray(dailyChallenges.id, DEMO_IDS.challenges));
      await tx.delete(dailyMotivations).where(inArray(dailyMotivations.id, DEMO_IDS.motivations));
      await tx.delete(educationContents).where(inArray(educationContents.id, DEMO_IDS.education));
      await tx.delete(bookingReviews).where(inArray(bookingReviews.id, DEMO_IDS.reviews));
      await tx.delete(bookings).where(inArray(bookings.id, DEMO_IDS.bookings));
      await tx.delete(psychologistSessionSlots).where(inArray(psychologistSessionSlots.id, DEMO_IDS.slots));
      await tx.delete(psychologistSessionBundles).where(inArray(psychologistSessionBundles.id, DEMO_IDS.bundles));
      await tx.delete(psychologistCredentialFiles).where(inArray(psychologistCredentialFiles.id, DEMO_IDS.credentialFiles));
      await tx.delete(psychologistPracticePlaces).where(inArray(psychologistPracticePlaces.id, DEMO_IDS.practicePlaces));
      await tx.delete(profiles).where(eq(profiles.id, DEMO_IDS.patientProfile));
      await tx.delete(psychologistProfiles).where(inArray(psychologistProfiles.id, DEMO_IDS.psychologistProfiles));
      await tx.delete(users).where(inArray(users.id, [DEMO_IDS.patientUser, ...DEMO_IDS.psychologistUsers]));

      await tx.insert(users).values(demoUsers.map((user) => ({
        id: user.id,
        email: user.email,
        passwordHash,
        role: user.role,
        status: user.status,
        createdAt: DEMO_NOW,
        updatedAt: DEMO_NOW,
      })));

      await tx.insert(profiles).values(demoProfiles.map((profile) => ({
        id: profile.id,
        userId: profile.userId,
        nickname: profile.nickname,
        recoveryReason: profile.recoveryReason,
        dailyCheckinTime: profile.dailyCheckinTime,
        answers: profile.answers,
        dependencyLevel: profile.dependencyLevel,
        aiSummary: profile.aiSummary,
        onboardingCompletedAt: profile.onboardingCompletedAt,
        createdAt: DEMO_NOW,
        updatedAt: DEMO_NOW,
      })));

      await tx.insert(psychologistProfiles).values(demoPsychologistProfiles.map((profile) => ({
        id: profile.id,
        userId: profile.userId,
        type: profile.type,
        consultationChannel: profile.consultationChannel,
        approvalStatus: profile.approvalStatus,
        fullName: profile.fullName,
        dateOfBirth: profile.dateOfBirth,
        address: profile.address,
        photoUrl: profile.photoUrl,
        bio: profile.bio,
        createdAt: DEMO_NOW,
        updatedAt: DEMO_NOW,
      })));


      await tx.insert(psychologistPracticePlaces).values(demoPracticePlaces.map((place) => ({
        id: place.id,
        profileId: place.profileId,
        name: place.name,
        address: place.address,
        isActive: place.isActive,
        createdAt: DEMO_NOW,
        updatedAt: DEMO_NOW,
      })));

      await tx.insert(psychologistCredentialFiles).values(demoCredentialFiles.map((file) => ({
        id: file.id,
        profileId: file.profileId,
        documentType: file.documentType,
        objectKey: file.objectKey,
        fileName: file.fileName,
        contentType: file.contentType,
        sizeBytes: file.sizeBytes,
        createdAt: DEMO_NOW,
      })));

      await tx.insert(psychologistSessionBundles).values(demoSessionBundles.map((bundle) => ({
        id: bundle.id,
        profileId: bundle.profileId,
        packageName: bundle.packageName,
        packageDurationMinutes: bundle.packageDurationMinutes,
        priceAmount: bundle.priceAmount,
        dateStart: bundle.dateStart,
        dateEnd: bundle.dateEnd,
        dailyStartTime: bundle.dailyStartTime,
        dailyEndTime: bundle.dailyEndTime,
        createdAt: DEMO_NOW,
        updatedAt: DEMO_NOW,
      })));


      await tx.insert(psychologistSessionSlots).values(demoSessionSlots.map((slot) => ({
        id: slot.id,
        bundleId: slot.bundleId,
        profileId: slot.profileId,
        sessionDate: slot.sessionDate,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        status: slot.status,
        createdAt: DEMO_NOW,
        updatedAt: DEMO_NOW,
      })));

      await tx.insert(bookings).values(demoBookings.map((booking) => ({
        id: booking.id,
        patientUserId: booking.patientUserId,
        psychologistProfileId: booking.psychologistProfileId,
        sessionSlotId: booking.sessionSlotId,
        consultationChannel: booking.consultationChannel,
        status: booking.status,
        scheduledStartAt: booking.scheduledStartAt,
        scheduledEndAt: booking.scheduledEndAt,
        priceAmount: booking.priceAmount,
        packageNameSnapshot: booking.packageNameSnapshot,
        packageDurationMinutesSnapshot: booking.packageDurationMinutesSnapshot,
        paymentExpiresAt: booking.paymentExpiresAt,
        complaint: booking.complaint,
        meetLink: booking.meetLink,
        confirmedAt: booking.confirmedAt,
        rescheduledAt: booking.rescheduledAt,
        rescheduleReason: booking.rescheduleReason,
        createdAt: DEMO_NOW,
        updatedAt: DEMO_NOW,
      })));

      await tx.insert(bookingReviews).values(demoBookingReviews.map((review) => ({
        id: review.id,
        bookingId: review.bookingId,
        patientUserId: review.patientUserId,
        psychologistProfileId: review.psychologistProfileId,
        rating: review.rating,
        comment: review.comment,
        createdAt: DEMO_NOW,
        updatedAt: DEMO_NOW,
      })));

      await tx.insert(educationContents).values(demoEducationContents.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        url: item.url,
        thumbnailUrl: item.thumbnail_url,
        category: item.category,
        type: item.type,
        isActive: true,
        publishedAt: DEMO_NOW,
        createdAt: DEMO_NOW,
        updatedAt: DEMO_NOW,
      }))).onConflictDoUpdate({
        target: educationContents.id,
        set: {
          title: sql`excluded.title`,
          description: sql`excluded.description`,
          url: sql`excluded.url`,
          thumbnailUrl: sql`excluded.thumbnail_url`,
          category: sql`excluded.category`,
          type: sql`excluded.type`,
          publishedAt: sql`excluded.published_at`,
          updatedAt: DEMO_NOW,
        },
      });

      await tx.insert(dailyMotivations).values(demoDailyMotivations.map((content, index) => ({
        id: DEMO_IDS.motivations[index],
        content,
        isActive: true,
        createdAt: DEMO_NOW,
      }))).onConflictDoUpdate({
        target: dailyMotivations.content,
        set: {
          isActive: sql`excluded.is_active`,
        },
      });

      await tx.insert(dailyChallenges).values(demoDailyChallenges.map((item, index) => ({
        id: DEMO_IDS.challenges[index],
        title: item.title,
        description: item.description,
        content: item.content,
        isActive: true,
        createdAt: DEMO_NOW,
      }))).onConflictDoUpdate({
        target: dailyChallenges.content,
        set: {
          title: sql`excluded.title`,
          description: sql`excluded.description`,
          isActive: sql`excluded.is_active`,
        },
      });

      await tx.insert(dailyPhysicalChallenges).values(demoPhysicalChallenges.map((item) => ({
        title: item.title,
        description: item.description,
        isActive: true,
        createdAt: DEMO_NOW,
      }))).onConflictDoNothing();

      await tx.insert(achievements).values(demoAchievements.map((achievement, index) => ({
        id: DEMO_IDS.achievements[index],
        key: achievement.key,
        title: achievement.title,
        description: achievement.description,
        criteria: achievement.criteria,
        createdAt: DEMO_NOW,
      }))).onConflictDoUpdate({
        target: achievements.key,
        set: {
          id: sql`excluded.id`,
          title: sql`excluded.title`,
          description: sql`excluded.description`,
          criteria: sql`excluded.criteria`,
        },
      });

      await tx.insert(communityPosts).values(demoCommunityPosts.map((post) => ({
        id: post.id,
        userId: post.userId,
        category: post.category,
        content: post.content,
        likeCount: 0,
        commentCount: 0,
        createdAt: DEMO_NOW,
        updatedAt: DEMO_NOW,
      }))).onConflictDoUpdate({
        target: communityPosts.id,
        set: {
          userId: sql`excluded.user_id`,
          category: sql`excluded.category`,
          content: sql`excluded.content`,
          updatedAt: DEMO_NOW,
        },
      });

      await tx.insert(communityComments).values(demoCommunityComments.map((comment) => ({
        id: comment.id,
        postId: comment.postId,
        userId: comment.userId,
        content: comment.content,
        createdAt: DEMO_NOW,
      }))).onConflictDoUpdate({
        target: communityComments.id,
        set: {
          postId: sql`excluded.post_id`,
          userId: sql`excluded.user_id`,
          content: sql`excluded.content`,
        },
      });

      for (const like of demoCommunityLikes) {
        await tx.insert(communityPostLikes).values({
          postId: like.postId,
          userId: like.userId,
          createdAt: DEMO_NOW,
        }).onConflictDoNothing();
      }

      for (const post of demoCommunityPosts) {
        const likeCount = demoCommunityLikes.filter((item) => item.postId === post.id).length;
        const commentCount = demoCommunityComments.filter((item) => item.postId === post.id).length;
        await tx.update(communityPosts).set({ likeCount, commentCount, updatedAt: DEMO_NOW }).where(eq(communityPosts.id, post.id));
      }
    });

    console.log("Demo seed complete.");
    console.log("Patient: patient.demo@pulih.local / PulihDemo123!");
    console.log("Psychologists: maya.prameswari@pulih.local and 11 more / PulihDemo123!");
    console.log(`Seeded content: ${demoPsychologistProfiles.length} psychologists, ${demoSessionBundles.length} session bundles, ${demoSessionSlots.length} session slots, ${demoBookings.length} bookings, ${demoBookingReviews.length} reviews, ${demoEducationContents.length} education, ${demoDailyMotivations.length} motivations, ${demoDailyChallenges.length} challenges, ${demoPhysicalChallenges.length} physical challenges, ${demoAchievements.length} achievements, ${demoCommunityPosts.length} community posts.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
