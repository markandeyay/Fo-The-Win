export interface RoundScoreInput {
  correct: boolean;
  timedOut?: boolean;
  remainingFraction?: number;
  firstSolve?: boolean;
  ranked?: boolean;
  wrongPenalty?: number;
}

export function computeSpeedPoints(remainingFraction: number): number {
  const clamped = Math.max(0, Math.min(1, remainingFraction));
  return Math.round(1000 * clamped);
}

export function computeRoundPoints(input: RoundScoreInput): number {
  if (!input.correct || input.timedOut) {
    if (input.ranked && input.wrongPenalty !== 0) {
      return input.wrongPenalty ?? -100;
    }
    return 0;
  }

  const speed = computeSpeedPoints(input.remainingFraction ?? 0);
  let points = 500 + speed;
  if (input.firstSolve) {
    points += 200;
  }
  return points;
}

export interface RoundSummary {
  points: number;
  correct: boolean;
  timeMs: number;
}

export function computeSessionScore(
  rounds: RoundSummary[],
  options?: { firstSolveBonus?: boolean; ranked?: boolean }
): {
  score: number;
  correctCount: number;
  totalTimeMs: number;
} {
  const ranked = options?.ranked ?? false;
  const firstSolveBonus = options?.firstSolveBonus ?? false;
  let score = 0;
  let correctCount = 0;
  let totalTimeMs = 0;

  for (const round of rounds) {
    score += computeRoundPoints({
      correct: round.correct,
      timedOut: round.timeMs === 0 && !round.correct,
      remainingFraction: round.timeMs > 0 ? round.timeMs / 1000 : 0,
      ranked,
      firstSolve: firstSolveBonus && round.correct,
    });
    if (round.correct) {
      correctCount += 1;
      totalTimeMs += round.timeMs;
    }
  }

  return { score, correctCount, totalTimeMs };
}

export interface PlayerResult {
  userId: string;
  score: number;
  correctCount: number;
  totalTimeMs: number;
}

export function comparePlayerResults(a: PlayerResult, b: PlayerResult): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.correctCount !== b.correctCount) return b.correctCount - a.correctCount;
  return a.totalTimeMs - b.totalTimeMs;
}

export function assignPlacements(results: PlayerResult[]): PlayerResult[] {
  const sorted = [...results].sort(comparePlayerResults);
  return sorted.map((r, index) => ({ ...r, placement: index + 1 }));
}
