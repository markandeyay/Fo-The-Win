import { describe, it, expect } from "vitest";
import {
  START_RATING,
  expectedScore,
  kFactor,
  computeRatingDeltas,
} from "../../lib/elo";

describe("constants", () => {
  it("starts new players at 1200", () => {
    expect(START_RATING).toBe(1200);
  });
});

describe("expectedScore", () => {
  it("is 0.5 for equal ratings", () => {
    expect(expectedScore(1200, 1200)).toBe(0.5);
  });

  it("favors the higher-rated player", () => {
    expect(expectedScore(1400, 1200)).toBeGreaterThan(0.5);
    expect(expectedScore(1200, 1400)).toBeLessThan(0.5);
  });
});

describe("kFactor", () => {
  it("is 32 for fewer than 30 games", () => {
    expect(kFactor(0)).toBe(32);
    expect(kFactor(29)).toBe(32);
  });

  it("is 16 for 30 or more games", () => {
    expect(kFactor(30)).toBe(16);
    expect(kFactor(100)).toBe(16);
  });
});

describe("computeRatingDeltas", () => {
  it("sums to zero across players", () => {
    const players = [
      { id: "a", rating: 1200, gamesPlayed: 10, placement: 1 },
      { id: "b", rating: 1200, gamesPlayed: 10, placement: 2 },
      { id: "c", rating: 1200, gamesPlayed: 10, placement: 3 },
    ];
    const deltas = computeRatingDeltas(players);
    const sum = deltas.reduce((acc, d) => acc + d.delta, 0);
    expect(sum).toBe(0);
  });

  it("rewards winners and penalizes losers", () => {
    const players = [
      { id: "a", rating: 1200, gamesPlayed: 10, placement: 1 },
      { id: "b", rating: 1200, gamesPlayed: 10, placement: 2 },
    ];
    const deltas = computeRatingDeltas(players);
    const aDelta = deltas.find((d) => d.id === "a")!.delta;
    const bDelta = deltas.find((d) => d.id === "b")!.delta;
    expect(aDelta).toBeGreaterThan(0);
    expect(bDelta).toBeLessThan(0);
  });

  it("handles ties with zero net delta", () => {
    const players = [
      { id: "a", rating: 1200, gamesPlayed: 10, placement: 1 },
      { id: "b", rating: 1200, gamesPlayed: 10, placement: 1 },
    ];
    const deltas = computeRatingDeltas(players);
    expect(deltas[0].delta).toBe(0);
    expect(deltas[1].delta).toBe(0);
  });
});
