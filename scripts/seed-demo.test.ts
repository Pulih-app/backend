import { describe, expect, test } from "bun:test";
import {
  demoAchievements,
  demoCommunityComments,
  demoCommunityLikes,
  demoCommunityPosts,
  demoDailyChallenges,
  demoDailyMotivations,
  demoEducationContents,
  demoCredentialFiles,
  demoPsychologistProfiles,
  demoSessionBundles,
  demoSessionSlots,
} from "./seed-demo-data";

describe("demo seed data", () => {
  test("meets content breadth targets", () => {
    expect(demoEducationContents).toHaveLength(31);
    expect(demoDailyMotivations).toHaveLength(35);
    expect(demoDailyChallenges).toHaveLength(70);
    expect(demoAchievements).toHaveLength(12);
    expect(demoCommunityPosts).toHaveLength(6);
    expect(demoCommunityComments).toHaveLength(12);
    expect(demoCommunityLikes).toHaveLength(10);
    expect(demoPsychologistProfiles).toHaveLength(12);
    expect(demoCredentialFiles).toHaveLength(42);
    expect(demoCredentialFiles.every((file) => file.id)).toBe(true);
    expect(demoSessionBundles).toHaveLength(24);
    expect(demoSessionSlots).toHaveLength(168);
  });

  test("uses Recova-aligned English content", () => {
    expect(demoEducationContents[0]?.title).toContain("Addiction");
    expect(demoDailyMotivations[0]).toContain("better version");
    expect(demoDailyChallenges[0].description).toContain("Wake up");
    expect(demoCommunityPosts[0]?.content).toContain("routine");
    expect(demoPsychologistProfiles[0]?.bio).toContain("addiction recovery");
    expect(demoPsychologistProfiles.some((profile) => profile.consultationChannel === "chat_and_meet")).toBe(true);
  });
});
