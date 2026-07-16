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
    expect(demoEducationContents).toHaveLength(16);
    expect(demoDailyMotivations).toHaveLength(30);
    expect(demoDailyChallenges).toHaveLength(30);
    expect(demoAchievements).toHaveLength(12);
    expect(demoCommunityPosts).toHaveLength(6);
    expect(demoCommunityComments).toHaveLength(12);
    expect(demoCommunityLikes).toHaveLength(10);
    expect(demoSessionSlots).toHaveLength(3);
  });

  test("uses synthetic English content", () => {
    expect(demoEducationContents[0]?.title).toContain("Understanding");
    expect(demoDailyMotivations[0]).toContain("progress");
    expect(demoDailyChallenges[0].description).toContain("Pause");
    expect(demoCommunityPosts[0]?.content).toContain("routine");
  });
});
