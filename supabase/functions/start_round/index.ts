import {
  assertRoundIndex,
  assertString,
  broadcastRoomEvent,
  handleError,
  json,
  optionsResponse,
  parseJsonBody,
  problemProjection,
  requireAuthedUser,
  requireHostSession,
} from "../_shared/game.ts";

// TODO(Checkpoint 19.4): Deploy only after the human confirms Edge Function deploy and host-driven round pacing.
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "POST") return json({ error: { code: "method_not_allowed" } }, 405);

  try {
    const context = await requireAuthedUser(request);
    if (context instanceof Response) return context;

    const body = await parseJsonBody(request);
    const sessionId = assertString(body.session_id, "session_id");
    const roundIndex = assertRoundIndex(body.round_index);
    const session = await requireHostSession(context.service, sessionId, context.user.id);

    const { data: round, error: roundError } = await context.service
      .from("session_rounds")
      .select("*")
      .eq("session_id", sessionId)
      .eq("round_index", roundIndex)
      .single();
    if (roundError || !round) return json({ error: { code: "round_not_found", message: "Round not found" } }, 404);

    let serverStartTs = round.server_start_ts as string | null;
    if (!serverStartTs) {
      const now = new Date().toISOString();
      const { data: startedRound, error: startError } = await context.service
        .from("session_rounds")
        .update({ server_start_ts: now })
        .eq("session_id", sessionId)
        .eq("round_index", roundIndex)
        .is("server_start_ts", null)
        .select("server_start_ts")
        .maybeSingle();
      if (startError) throw new Error(startError.message);
      serverStartTs = startedRound?.server_start_ts ?? now;
    }

    const { data: problem, error: problemError } = await context.service
      .from("problems")
      .select("id, topic_id, group_id, difficulty, prompt_latex, answer_format, choices")
      .eq("id", round.problem_id)
      .single();
    if (problemError || !problem) return json({ error: { code: "problem_not_found", message: "Problem not found" } }, 404);

    await context.service.from("game_sessions").update({ state: "question_active" }).eq("id", sessionId);

    const payload = {
      round_index: roundIndex,
      problem: problemProjection(problem),
      server_start_ts: serverStartTs,
      duration_ms: round.duration_ms,
    };
    await broadcastRoomEvent(context.service, session.room_code, "round_start", payload);

    return json(payload);
  } catch (error) {
    return handleError(error);
  }
});
