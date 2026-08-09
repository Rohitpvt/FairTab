import { describe, test, expect } from "vitest";
import {
  calculateOccurrenceSequence,
  getOccurrenceDate,
  getLocalDateInTimezone,
} from "./scheduling.js";

describe("Domain Scheduling Logic", () => {
  describe("getOccurrenceDate & Sequence math", () => {
    test("daily recurrence with custom intervals", () => {
      const start = "2026-03-01";
      // index=0 should return startLocalDate itself
      expect(getOccurrenceDate(start, "daily", 2, 0)).toBe("2026-03-01");
      expect(getOccurrenceDate(start, "daily", 2, 1)).toBe("2026-03-03");
      expect(getOccurrenceDate(start, "daily", 2, 2)).toBe("2026-03-05");
      expect(getOccurrenceDate(start, "daily", 1, 5)).toBe("2026-03-06");
    });

    test("weekly recurrence", () => {
      const start = "2026-03-01"; // Sunday
      expect(getOccurrenceDate(start, "weekly", 1, 1)).toBe("2026-03-08"); // Next Sunday
      expect(getOccurrenceDate(start, "weekly", 2, 1)).toBe("2026-03-15"); // 2 weeks later
    });

    test("monthly recurrence with month-end alignment", () => {
      const start = "2026-01-31";
      // Jan 31 -> Feb 28 -> Mar 31 -> Apr 30
      expect(getOccurrenceDate(start, "monthly", 1, 0)).toBe("2026-01-31");
      expect(getOccurrenceDate(start, "monthly", 1, 1)).toBe("2026-02-28"); // Feb has 28 days
      expect(getOccurrenceDate(start, "monthly", 1, 2)).toBe("2026-03-31"); // Mar has 31 days
      expect(getOccurrenceDate(start, "monthly", 1, 3)).toBe("2026-04-30"); // Apr has 30 days
    });

    test("monthly recurrence in a leap year", () => {
      const start = "2024-01-31"; // 2024 is leap year
      expect(getOccurrenceDate(start, "monthly", 1, 1)).toBe("2024-02-29"); // Feb has 29 days
      expect(getOccurrenceDate(start, "monthly", 1, 2)).toBe("2024-03-31");
    });

    test("yearly recurrence and leap day fallback", () => {
      const start = "2024-02-29"; // Leap day
      expect(getOccurrenceDate(start, "yearly", 1, 0)).toBe("2024-02-29");
      expect(getOccurrenceDate(start, "yearly", 1, 1)).toBe("2025-02-28"); // Non-leap year fallback
      expect(getOccurrenceDate(start, "yearly", 1, 4)).toBe("2028-02-29"); // Next leap year
    });

    test("sequence generation up to a limit", () => {
      const start = "2026-01-15";
      const limit = "2026-04-20";
      const seq = calculateOccurrenceSequence(start, "monthly", 1, limit);
      expect(seq).toEqual([
        "2026-01-15",
        "2026-02-15",
        "2026-03-15",
        "2026-04-15",
      ]);
    });

    test("sequence generation with end date cap", () => {
      const start = "2026-01-15";
      const limit = "2026-06-01";
      const endDate = "2026-03-20";
      const seq = calculateOccurrenceSequence(start, "monthly", 1, limit, endDate);
      expect(seq).toEqual([
        "2026-01-15",
        "2026-02-15",
        "2026-03-15",
      ]);
    });
  });

  describe("timezone local date conversion", () => {
    test("correct conversion for specific timezone offsets", () => {
      // 2026-08-01 01:00:00 UTC (1785546000000 ms)
      const timestamp = Date.UTC(2026, 7, 1, 1, 0, 0);

      // Asia/Kolkata is UTC+5:30 -> local time is 2026-08-01 06:30:00
      expect(getLocalDateInTimezone(timestamp, "Asia/Kolkata")).toBe("2026-08-01");

      // America/New_York is UTC-4 (EDT) -> local time is 2026-07-31 21:00:00
      expect(getLocalDateInTimezone(timestamp, "America/New_York")).toBe("2026-07-31");
    });
  });
});
