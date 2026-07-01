import { describe, it, expect } from "vitest";
import {
  BASE_TIME_SECONDS,
  roundDurationSeconds,
  roundDurationMs,
  remainingFraction,
} from "../../lib/timing";

describe("BASE_TIME_SECONDS", () => {
  it("has the expected base times", () => {
    expect(BASE_TIME_SECONDS.easy).toBe(25);
    expect(BASE_TIME_SECONDS.medium).toBe(45);
    expect(BASE_TIME_SECONDS.hard).toBe(75);
  });
});

describe("roundDurationSeconds", () => {
  it("scales by complexity factor", () => {
    expect(roundDurationSeconds("easy", 1.0)).toBe(25);
    expect(roundDurationSeconds("medium", 1.0)).toBe(45);
    expect(roundDurationSeconds("hard", 1.0)).toBe(75);
  });

  it("clamps complexity factor", () => {
    expect(roundDurationSeconds("easy", 0.1)).toBe(Math.round(25 * 0.6));
    expect(roundDurationSeconds("easy", 10)).toBe(Math.round(25 * 1.6));
  });

  it("enforces an 8 second minimum", () => {
    expect(roundDurationSeconds("easy", 0.6)).toBe(15);
    expect(roundDurationSeconds("easy", 0.6)).toBeGreaterThanOrEqual(8);
  });

  it("is case-insensitive", () => {
    expect(roundDurationSeconds("EASY", 1.0)).toBe(25);
  });
});

describe("roundDurationMs", () => {
  it("returns seconds times 1000", () => {
    expect(roundDurationMs("easy", 1.0)).toBe(25000);
  });
});

describe("remainingFraction", () => {
  it("returns 1 at start", () => {
    expect(remainingFraction(10000, 0)).toBe(1);
  });

  it("returns 0 at deadline", () => {
    expect(remainingFraction(10000, 10000)).toBe(0);
  });

  it("clamps after deadline", () => {
    expect(remainingFraction(10000, 15000)).toBe(0);
  });
});
