import { describe, expect, it } from "vitest";
import { calculateLegalLeaveDays, countBusinessDays } from "./leaveCalc";

describe("calculateLegalLeaveDays", () => {
  it("should give 0 days for entry date in the future", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const result = calculateLegalLeaveDays(future, new Date());
    expect(result).toBe(0);
  });

  it("should give 1 day per month for first year (1 month)", () => {
    const entry = new Date("2025-01-01");
    const ref = new Date("2025-02-01");
    const result = calculateLegalLeaveDays(entry, ref);
    expect(result).toBe(1);
  });

  it("should give 11 days max for 11 months in first year", () => {
    const entry = new Date("2025-01-01");
    const ref = new Date("2025-12-01");
    const result = calculateLegalLeaveDays(entry, ref);
    expect(result).toBe(11);
  });

  it("should give 15 days for exactly 1 year of service", () => {
    const entry = new Date("2024-01-01");
    const ref = new Date("2025-01-01");
    const result = calculateLegalLeaveDays(entry, ref);
    expect(result).toBe(15);
  });

  it("should give 16 days for 3 years of service", () => {
    const entry = new Date("2022-01-01");
    const ref = new Date("2025-01-01");
    const result = calculateLegalLeaveDays(entry, ref);
    expect(result).toBe(16);
  });

  it("should give 17 days for 5 years of service", () => {
    const entry = new Date("2020-01-01");
    const ref = new Date("2025-01-01");
    const result = calculateLegalLeaveDays(entry, ref);
    expect(result).toBe(17);
  });

  it("should cap at 25 days maximum", () => {
    const entry = new Date("2000-01-01");
    const ref = new Date("2025-01-01");
    const result = calculateLegalLeaveDays(entry, ref);
    expect(result).toBe(25);
  });

  it("should give 25 days for 21+ years of service", () => {
    const entry = new Date("2003-01-01");
    const ref = new Date("2025-01-01");
    const result = calculateLegalLeaveDays(entry, ref);
    expect(result).toBe(25);
  });
});

describe("countBusinessDays", () => {
  it("should count 1 business day for a single weekday", () => {
    // 2025-01-06 is a Monday
    const result = countBusinessDays("2025-01-06", "2025-01-06");
    expect(result).toBe(1);
  });

  it("should count 5 business days for Mon-Fri", () => {
    // 2025-01-06 Mon ~ 2025-01-10 Fri
    const result = countBusinessDays("2025-01-06", "2025-01-10");
    expect(result).toBe(5);
  });

  it("should skip weekends", () => {
    // 2025-01-06 Mon ~ 2025-01-12 Sun = 5 weekdays
    const result = countBusinessDays("2025-01-06", "2025-01-12");
    expect(result).toBe(5);
  });

  it("should count 0 for a weekend range", () => {
    // 2025-01-11 Sat ~ 2025-01-12 Sun
    const result = countBusinessDays("2025-01-11", "2025-01-12");
    expect(result).toBe(0);
  });

  it("should return 0 when end is before start", () => {
    const result = countBusinessDays("2025-01-10", "2025-01-06");
    expect(result).toBe(0);
  });
});
