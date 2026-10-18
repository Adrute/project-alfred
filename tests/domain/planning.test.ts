import { describe, expect, it } from "vitest";
import { hasTimeOverlap, mondayOfWeek, validateActivityDuration, weekDateKeys } from "@/domain/planning";

describe("planning rules", () => {
  it("resolves a stable Monday-to-Sunday week", () => {
    expect(mondayOfWeek("2026-10-16")).toBe("2026-10-12");
    expect(weekDateKeys("2026-10-16")).toEqual([
      "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18",
    ]);
  });

  it("detects overlaps but accepts adjacent slots", () => {
    expect(hasTimeOverlap({ startMinute: 540, endMinute: 595 }, { startMinute: 580, endMinute: 630 })).toBe(true);
    expect(hasTimeOverlap({ startMinute: 540, endMinute: 595 }, { startMinute: 595, endMinute: 650 })).toBe(false);
  });

  it("rejects activities longer than the lesson", () => {
    expect(validateActivityDuration(540, 595, [{ durationMinutes: 25 }, { durationMinutes: 30 }]).valid).toBe(true);
    expect(validateActivityDuration(540, 595, [{ durationMinutes: 30 }, { durationMinutes: 30 }])).toMatchObject({ valid: false, availableMinutes: 55, plannedMinutes: 60 });
  });
});
