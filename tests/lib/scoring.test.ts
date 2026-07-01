import { describe, it, expect } from "vitest";
import {
  computeSpeedPoints,
  computeRoundPoints,
  computeSessionScore,
  comparePlayerResults,
} from "../../lib/scoring";

describe("computeSpeedPoints", () => {
  it("returns 1000 for an instant answer", () => {
    expect(computeSpeedPoints(1)).toBe(1000);
  });

  it("returns 500 at half time", () => {
    expect(computeSpeedPoints(0.5)).toBe(500);
  });

  it("returns 0 at deadline", () => {
    expect(computeSpeedPoints(0)).toBe(0);
  });

  it("clamps out-of-range values", () => {
    expect(computeSpeedPoints(1.5)).toBe(1000);
    expect(computeSpeedPoints(-0.2)).toBe(0);
  });
});

describe("computeRoundPoints", () => {
  it("gives base + speed for a correct answer", () => {
    expect(computeRoundPoints({ correct: true, remainingFraction: 0.5 })).toBe(1000);
  });

  it("gives 500 base for a last-instant correct answer", () => {
    expect(computeRoundPoints({ correct: true, remainingFraction: 0 })).toBe(500);
  });

  it("adds first-solve bonus", () => {
    expect(computeRoundPoints({ correct: true, remainingFraction: 1, firstSolve: true })).toBe(1700);
  });

  it("returns 0 for a wrong casual answer", () => {
    expect(computeRoundPoints({ correct: false })).toBe(0);
  });

  it("returns 0 for a timeout", () => {
    expect(computeRoundPoints({ correct: false, timedOut: true })).toBe(0);
  });

  it("applies ranked wrong penalty", () => {
    expect(computeRoundPoints({ correct: false, ranked: true })).toBe(-100);
  });

  it("allows disabling ranked wrong penalty", () => {
    expect(computeRoundPoints({ correct: false, ranked: true, wrongPenalty: 0 })).toBe(0);
  });
});

describe("computeSessionScore", () => {
  it("sums round scores and counts correct answers", () => {
    const rounds = [
      { points: 0, correct: true, timeMs: 20000 },
      { points: 0, correct: false, timeMs: 0 },
      { points: 0, correct: true, timeMs: 10000 },
    ];
    const result = computeSessionScore(rounds);
    expect(result.correctCount).toBe(2);
    expect(result.totalTimeMs).toBe(30000);
  });
});

describe("comparePlayerResults", () => {
  it("ranks higher score first", () => {
    const a = { userId: "a", score: 1200, correctCount: 2, totalTimeMs: 1000 };
    const b = { userId: "b", score: 900, correctCount: 3, totalTimeMs: 500 };
    expect(comparePlayerResults(a, b)).toBeLessThan(0);
  });

  it("breaks ties by correct count", () => {
    const a = { userId: "a", score: 1000, correctCount: 3, totalTimeMs: 2000 };
    const b = { userId: "b", score: 1000, correctCount: 2, totalTimeMs: 1000 };
    expect(comparePlayerResults(a, b)).toBeLessThan(0);
  });

  it("breaks ties by total time", () => {
    const a = { userId: "a", score: 1000, correctCount: 2, totalTimeMs: 1000 };
    const b = { userId: "b", score: 1000, correctCount: 2, totalTimeMs: 2000 };
    expect(comparePlayerResults(a, b)).toBeLessThan(0);
  });
});
