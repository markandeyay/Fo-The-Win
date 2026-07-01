import {
  NETWORK_GRACE_MS,
  assertRoundIndex,
  assertString,
  handleError,
  json,
  optionsResponse,
  parseJsonBody,
  requireAuthedUser,
  requireParticipant,
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
    const submitted = assertString(body.answer, "answer");

    await requireParticipant(context.service, sessionId, context.user.id);

    const { data: round, error: roundError } = await context.service
      .from("session_rounds")
      .select("server_start_ts, duration_ms")
      .eq("session_id", sessionId)
      .eq("round_index", roundIndex)
      .single();
    if (roundError || !round) return json({ accepted: false, reason: "round_not_found", time_ms: 0 }, 404);
    if (!round.server_start_ts) return json({ accepted: false, reason: "round_not_started", time_ms: 0 }, 409);

    const elapsedMs = Math.max(0, Date.now() - Date.parse(round.server_start_ts));
    if (elapsedMs > Number(round.duration_ms) + NETWORK_GRACE_MS) {
      return json({ accepted: false, reason: "late", time_ms: elapsedMs }, 409);
    }

    const { error: insertError } = await context.service.from("round_answers").insert({
      session_id: sessionId,
      round_index: roundIndex,
      user_id: context.user.id,
      submitted,
      time_ms: elapsedMs,
      is_correct: false,
      points: 0,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        return json({ accepted: false, reason: "duplicate", time_ms: elapsedMs }, 409);
      }
      throw new Error(insertError.message);
    }

    return json({ accepted: true, time_ms: elapsedMs });
  } catch (error) {
    return handleError(error);
  }
});
