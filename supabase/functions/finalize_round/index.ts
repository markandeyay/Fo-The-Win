import {
  NETWORK_GRACE_MS,
  answersEquivalent,
  assertRoundIndex,
  assertString,
  assignPlacements,
  broadcastRoomEvent,
  computeRoundPoints,
  handleError,
  json,
  optionsResponse,
  parseJsonBody,
  remainingFraction,
  requireAuthedUser,
  requireHostSession,
  loadSessionPlayers,
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
    const players = await loadSessionPlayers(context.service, sessionId);

    const { data: round, error: roundError } = await context.service
      .from("session_rounds")
      .select("*")
      .eq("session_id", sessionId)
      .eq("round_index", roundIndex)
      .single();
    if (roundError || !round) return json({ error: { code: "round_not_found", message: "Round not found" } }, 404);
    if (!round.server_start_ts) return json({ error: { code: "round_not_started", message: "Round has not started" } }, 409);

    const { data: problem, error: problemError } = await context.service
      .from("problems")
      .select("id, topic_id, group_id, difficulty, answer_format, correct_choice, correct_answer, accepted_forms, solution_latex")
      .eq("id", round.problem_id)
      .single();
    if (problemError || !problem) return json({ error: { code: "problem_not_found", message: "Problem not found" } }, 404);

    const { data: answers, error: answersError } = await context.service
      .from("round_answers")
      .select("*")
      .eq("session_id", sessionId)
      .eq("round_index", roundIndex);
    if (answersError) throw new Error(answersError.message);

    const answeredCount = answers?.length ?? 0;
    const deadlineMs = Date.parse(round.server_start_ts) + Number(round.duration_ms) + NETWORK_GRACE_MS;
    if (answeredCount < players.length && Date.now() < deadlineMs) {
      return json({ error: { code: "round_still_active", message: "Round cannot be finalized before all players answer or time expires" } }, 409);
    }

    const ranked = Boolean(session.ranked);
    const config = session.config ?? {};
    const firstSolveBonus = typeof config.firstSolveBonus === "boolean" ? config.firstSolveBonus : !ranked;
    const scoredAnswers = (answers ?? []).map((answer: any) => ({
      ...answer,
      is_correct: answersEquivalent(String(answer.submitted ?? ""), problem),
    }));
    const firstCorrect = scoredAnswers
      .filter((answer: any) => answer.is_correct)
      .sort((a: any, b: any) => Number(a.time_ms ?? 0) - Number(b.time_ms ?? 0))[0]?.user_id;

    const perPlayerResults = scoredAnswers.map((answer: any) => {
      const points = computeRoundPoints({
        correct: answer.is_correct,
        ranked,
        firstSolve: firstSolveBonus && answer.user_id === firstCorrect,
        remainingFraction: remainingFraction(Number(round.duration_ms), Number(answer.time_ms ?? round.duration_ms)),
      });
      return { ...answer, points };
    });

    await Promise.all(perPlayerResults.map((answer: any) => context.service
      .from("round_answers")
      .update({ is_correct: answer.is_correct, points: answer.points })
      .eq("session_id", sessionId)
      .eq("round_index", roundIndex)
      .eq("user_id", answer.user_id)));

    const { data: allAnswers, error: allAnswersError } = await context.service
      .from("round_answers")
      .select("user_id, is_correct, time_ms, points")
      .eq("session_id", sessionId);
    if (allAnswersError) throw new Error(allAnswersError.message);

    const aggregates = new Map<string, { score: number; correctCount: number; totalTimeMs: number }>();
    for (const player of players) aggregates.set(player.user_id, { score: 0, correctCount: 0, totalTimeMs: 0 });
    for (const answer of allAnswers ?? []) {
      const aggregate = aggregates.get(answer.user_id);
      if (!aggregate) continue;
      aggregate.score += Number(answer.points ?? 0);
      if (answer.is_correct) {
        aggregate.correctCount += 1;
        aggregate.totalTimeMs += Number(answer.time_ms ?? 0);
      }
    }

    const scoreboard = assignPlacements(Array.from(aggregates.entries()).map(([userId, aggregate]) => ({
      userId,
      score: aggregate.score,
      correctCount: aggregate.correctCount,
      totalTimeMs: aggregate.totalTimeMs,
    })));

    await Promise.all(scoreboard.map((row) => context.service
      .from("session_players")
      .update({ score: row.score, correct_count: row.correctCount, total_time_ms: row.totalTimeMs })
      .eq("session_id", sessionId)
      .eq("user_id", row.userId)));

    await context.service.from("game_sessions").update({ state: "question_reveal" }).eq("id", sessionId);

    const payload = {
      correct_answer: problem.correct_answer,
      correct_choice: problem.correct_choice,
      solution: problem.solution_latex,
      per_player_results: perPlayerResults.map((answer: any) => ({
        user_id: answer.user_id,
        submitted: answer.submitted,
        is_correct: answer.is_correct,
        time_ms: answer.time_ms,
        points: answer.points,
      })),
      scoreboard,
    };

    await broadcastRoomEvent(context.service, session.room_code, "round_reveal", payload);
    return json(payload);
  } catch (error) {
    return handleError(error);
  }
});
