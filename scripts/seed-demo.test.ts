import { describe, expect, test } from "bun:test";
import {
  demoAchievements,
  demoCommunityComments,
  demoCommunityLikes,
  demoCommunityPosts,
  demoDailyChallenges,
  demoDailyMotivations,
  demoEducationContents,
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
    expect(demoSessionSlots).toHaveLength(3);
  });

  test("uses Recova-aligned English content", () => {
    expect(demoEducationContents[0]?.title).toContain("Addiction");
    expect(demoDailyMotivations[0]).toContain("better version");
    expect(demoDailyChallenges[0].description).toContain("Wake up");
    expect(demoCommunityPosts[0]?.content).toContain("routine");
  });
});
