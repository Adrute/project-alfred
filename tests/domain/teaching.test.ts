import { describe, expect, it } from "vitest";
import { weightedGradeAverage } from "@/domain/teaching";

describe("weighted grade average", () => {
  it("normalizes different maximum scores and applies weights", () => {
    expect(weightedGradeAverage([
      { score: 8, maxScore: 10, weight: 1 },
      { score: 18, maxScore: 20, weight: 2 },
    ])).toBe(8.7);
  });

  it("returns null without valid grades", () => {
    expect(weightedGradeAverage([])).toBeNull();
    expect(weightedGradeAverage([{ score: 8, maxScore: 0, weight: 1 }])).toBeNull();
  });
});
