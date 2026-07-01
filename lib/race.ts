export type RaceMode = "sprint" | "first_to_n";
export type RacePlayerMode = "solo" | "mp";

export interface RaceConfig {
  minFactor: number;
  maxFactor: number;
  mode: RaceMode;
  playerMode: RacePlayerMode;
  durationSec: number;
  targetCorrect: number;
  seed: string;
  roomCode?: string;
}

export interface RaceProblem {
  index: number;
  a: number;
  b: number;
  answer: number;
}

export interface RaceResult {
  id: string;
  mode: RaceMode;
  minFactor: number;
  maxFactor: number;
  seed: string;
  correct: number;
  wrong: number;
  durationMs: number;
  targetCorrect: number;
  createdAt: string;
}

export const RACE_RESULTS_STORAGE_KEY = "ftw_race_results";

export function clampFactor(value: number): number {
  if (!Number.isFinite(value)) return 2;
  return Math.max(2, Math.min(99, Math.trunc(value)));
}

export function normalizeRaceConfig(input: Partial<RaceConfig>): RaceConfig {
  const minFactor = clampFactor(input.minFactor ?? 2);
  const maxFactor = clampFactor(input.maxFactor ?? 12);
  const low = Math.min(minFactor, maxFactor);
  const high = Math.max(minFactor, maxFactor);

  return {
    minFactor: low,
    maxFactor: high,
    mode: input.mode === "first_to_n" ? "first_to_n" : "sprint",
    playerMode: input.playerMode === "mp" ? "mp" : "solo",
    durationSec: Math.max(10, Math.min(300, Math.trunc(input.durationSec ?? 60))),
    targetCorrect: Math.max(1, Math.min(200, Math.trunc(input.targetCorrect ?? 20))),
    seed: input.seed?.trim() || makeRaceSeed(),
    roomCode: input.roomCode?.trim().toUpperCase(),
  };
}

export function makeRaceSeed(): string {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  }
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

export function makeRaceRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  }
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateRaceProblem(config: Pick<RaceConfig, "seed" | "minFactor" | "maxFactor">, index: number): RaceProblem {
  const minFactor = clampFactor(config.minFactor);
  const maxFactor = clampFactor(config.maxFactor);
  const low = Math.min(minFactor, maxFactor);
  const high = Math.max(minFactor, maxFactor);
  const span = high - low + 1;
  const random = mulberry32(hashSeed(`${config.seed}:${index}`));
  const a = low + Math.floor(random() * span);
  const b = low + Math.floor(random() * span);

  return {
    index,
    a,
    b,
    answer: a * b,
  };
}

export function formatRaceTime(ms: number): string {
  const safeMs = Math.max(0, ms);
  const seconds = Math.floor(safeMs / 1000);
  const tenths = Math.floor((safeMs % 1000) / 100);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}:${rest.toString().padStart(2, "0")}.${tenths}` : `${rest}.${tenths}s`;
}

export function raceConfigKey(result: Pick<RaceResult, "mode" | "minFactor" | "maxFactor" | "targetCorrect">): string {
  const target = result.mode === "first_to_n" ? `:${result.targetCorrect}` : "";
  return `${result.mode}:${result.minFactor}-${result.maxFactor}${target}`;
}

export function compareRaceResults(a: RaceResult, b: RaceResult): number {
  if (a.mode !== b.mode) return a.mode.localeCompare(b.mode);
  if (a.mode === "sprint") {
    if (a.correct !== b.correct) return b.correct - a.correct;
    if (a.wrong !== b.wrong) return a.wrong - b.wrong;
    return a.durationMs - b.durationMs;
  }
  if (a.correct !== b.correct) return b.correct - a.correct;
  if (a.correct >= a.targetCorrect && b.correct >= b.targetCorrect) {
    return a.durationMs - b.durationMs;
  }
  return b.durationMs - a.durationMs;
}

export function getPersonalBest(results: RaceResult[], current: RaceResult): RaceResult | null {
  const key = raceConfigKey(current);
  return results
    .filter((result) => raceConfigKey(result) === key)
    .sort(compareRaceResults)[0] ?? null;
}
