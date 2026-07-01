import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

export const NETWORK_GRACE_MS = 500;
export const BASE_TIME_SECONDS: Record<string, number> = {
  easy: 25,
  medium: 45,
  hard: 75,
};

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export interface AuthedRequestContext {
  service: any;
  user: { id: string; is_anonymous?: boolean };
}

export interface PlayerResult {
  userId: string;
  score: number;
  correctCount: number;
  totalTimeMs: number;
  placement?: number;
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
    },
  });
}

export function optionsResponse(): Response {
  return new Response("ok", { headers: CORS_HEADERS });
}

export function errorResponse(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status);
}

export async function parseJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return {};
    return body as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function createServiceClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase service-role runtime environment variables");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function requireAuthedUser(request: Request): Promise<AuthedRequestContext | Response> {
  const service = createServiceClient();
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return errorResponse(401, "missing_auth", "Missing bearer token");
  }

  const { data, error } = await service.auth.getUser(token);
  if (error || !data?.user?.id) {
    return errorResponse(401, "invalid_auth", "Invalid bearer token");
  }

  return { service, user: data.user };
}

export async function loadSession(service: any, sessionId: string) {
  const { data, error } = await service
    .from("game_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error || !data) throw new HttpError(404, "session_not_found", "Session not found");
  return data;
}

export async function loadSessionPlayers(service: any, sessionId: string) {
  const { data, error } = await service
    .from("session_players")
    .select("*")
    .eq("session_id", sessionId);

  if (error) throw new HttpError(500, "players_fetch_failed", error.message);
  return data ?? [];
}

export async function requireParticipant(service: any, sessionId: string, userId: string) {
  const { data, error } = await service
    .from("session_players")
    .select("user_id")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new HttpError(500, "membership_check_failed", error.message);
  if (!data) throw new HttpError(403, "not_participant", "User is not a session participant");
}

export async function requireHostSession(service: any, sessionId: string, userId: string) {
  const session = await loadSession(service, sessionId);
  if (session.host_id !== userId) {
    throw new HttpError(403, "host_required", "Only the host may perform this action");
  }
  await requireParticipant(service, sessionId, userId);
  return session;
}

export class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function handleError(error: unknown): Response {
  if (error instanceof HttpError) {
    return errorResponse(error.status, error.code, error.message);
  }
  const message = error instanceof Error ? error.message : "Unknown error";
  return errorResponse(500, "internal_error", message);
}

export function assertString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, "invalid_request", `${name} is required`);
  }
  return value.trim();
}

export function assertRoundIndex(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new HttpError(400, "invalid_request", "round_index must be a non-negative integer");
  }
  return value;
}

export function roundDurationMs(difficulty: string, complexityFactor: number): number {
  const base = BASE_TIME_SECONDS[difficulty.toLowerCase()];
  if (!base) throw new HttpError(400, "invalid_difficulty", `Unknown difficulty: ${difficulty}`);
  const clamped = Math.max(0.6, Math.min(1.6, Number(complexityFactor) || 1));
  return Math.max(8, Math.round(base * clamped)) * 1000;
}

export function remainingFraction(totalMs: number, elapsedMs: number): number {
  if (totalMs <= 0) return 0;
  return Math.max(0, Math.min(1, (totalMs - elapsedMs) / totalMs));
}

export function computeRoundPoints(input: {
  correct: boolean;
  remainingFraction?: number;
  firstSolve?: boolean;
  ranked?: boolean;
  wrongPenalty?: number;
}): number {
  if (!input.correct) {
    if (input.ranked && input.wrongPenalty !== 0) return input.wrongPenalty ?? -100;
    return 0;
  }

  let points = 500 + Math.round(1000 * Math.max(0, Math.min(1, input.remainingFraction ?? 0)));
  if (input.firstSolve) points += 200;
  return points;
}

export function comparePlayerResults(a: PlayerResult, b: PlayerResult): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.correctCount !== b.correctCount) return b.correctCount - a.correctCount;
  return a.totalTimeMs - b.totalTimeMs;
}

export function assignPlacements(results: PlayerResult[]): PlayerResult[] {
  return [...results]
    .sort(comparePlayerResults)
    .map((result, index) => ({ ...result, placement: index + 1 }));
}

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function kFactor(gamesPlayed: number): number {
  return gamesPlayed < 30 ? 32 : 16;
}

export function computeRatingDeltas(players: { id: string; rating: number; gamesPlayed: number; placement: number }[]) {
  const deltas = new Map<string, number>();
  for (const player of players) deltas.set(player.id, 0);

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i];
      const b = players[j];
      let actualA = 0;
      if (a.placement < b.placement) actualA = 1;
      else if (a.placement === b.placement) actualA = 0.5;

      const expectedA = expectedScore(a.rating, b.rating);
      const k = Math.round((kFactor(a.gamesPlayed) + kFactor(b.gamesPlayed)) / 2);
      const deltaA = Math.round(k * (actualA - expectedA));
      deltas.set(a.id, (deltas.get(a.id) ?? 0) + deltaA);
      deltas.set(b.id, (deltas.get(b.id) ?? 0) - deltaA);
    }
  }

  return players.map((player) => ({
    id: player.id,
    delta: deltas.get(player.id) ?? 0,
    newRating: player.rating + (deltas.get(player.id) ?? 0),
  }));
}

export function problemProjection(problem: any) {
  return {
    id: problem.id,
    prompt_latex: problem.prompt_latex,
    answer_format: problem.answer_format,
    choices: problem.choices ?? undefined,
    topic_id: problem.topic_id,
    group_id: problem.group_id,
    difficulty: problem.difficulty,
  };
}

export function answersEquivalent(submitted: string, problem: any): boolean {
  const answer = submitted.trim();
  if (problem.answer_format === "mc") {
    return answer.toLowerCase() === String(problem.correct_choice ?? "").trim().toLowerCase();
  }

  const expected = String(problem.correct_answer ?? "").trim();
  const acceptedForms = Array.isArray(problem.accepted_forms) ? problem.accepted_forms : [];
  const candidates = [expected, ...acceptedForms.map(String)];
  const normalizedAnswer = normalizeLoose(answer);
  return candidates.some((candidate) => normalizeLoose(candidate) === normalizedAnswer);
}

function normalizeLoose(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

export async function broadcastRoomEvent(service: any, roomCode: string | null, event: string, payload: unknown) {
  if (!roomCode) return;
  await service.channel(`room:${roomCode}`).send({
    type: "broadcast",
    event,
    payload,
  });
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function levelForXp(xp: number): number {
  let level = 1;
  while ((100 * level * (level + 1)) / 2 <= xp) level += 1;
  return level;
}

export function localDateString(date: Date, timeZone = "UTC"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function daysBetweenDates(previous: string, current: string): number {
  const previousMs = Date.parse(`${previous}T00:00:00.000Z`);
  const currentMs = Date.parse(`${current}T00:00:00.000Z`);
  return Math.round((currentMs - previousMs) / 86_400_000);
}
