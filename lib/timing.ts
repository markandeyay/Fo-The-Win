export const BASE_TIME_SECONDS: Record<string, number> = {
  easy: 25,
  medium: 45,
  hard: 75,
};

export function roundDurationSeconds(
  difficulty: string,
  complexityFactor: number
): number {
  const base = BASE_TIME_SECONDS[difficulty.toLowerCase()];
  if (!base) {
    throw new Error(`Unknown difficulty: ${difficulty}`);
  }
  const clamped = Math.max(0.6, Math.min(1.6, complexityFactor));
  const seconds = Math.round(base * clamped);
  return Math.max(8, seconds);
}

export function roundDurationMs(
  difficulty: string,
  complexityFactor: number
): number {
  return roundDurationSeconds(difficulty, complexityFactor) * 1000;
}

export function remainingFraction(
  totalMs: number,
  elapsedMs: number
): number {
  if (totalMs <= 0) return 0;
  return Math.max(0, Math.min(1, (totalMs - elapsedMs) / totalMs));
}
