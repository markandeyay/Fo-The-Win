import {
  assertString,
  broadcastRoomEvent,
  handleError,
  json,
  optionsResponse,
  parseJsonBody,
  requireAuthedUser,
  requireHostSession,
  roundDurationMs,
  shuffle,
} from "../_shared/game.ts";

const MIXED_TOPIC_GROUPS: Record<string, string> = {
  "ch1.mixed": "ch1_rules",
  "ch2.mixed": "ch2_x_marks_spot",
  "ch3.mixed": "ch3_one_var_linear",
  "ch4.mixed": "ch4_more_variables",
  "ch5.mixed": "ch5_multivar_linear",
  "ch6.mixed": "ch6_ratios_percents",
  "ch7.mixed": "ch7_proportion",
  "ch8.mixed": "ch8_graphing_lines",
  "ch9.mixed": "ch9_inequalities",
  "ch10.mixed": "ch10_quadratics_1",
  "ch11.mixed": "ch11_special_factorizations",
  "ch12.mixed": "ch12_complex",
  "ch13.mixed": "ch13_quadratics_2",
  "ch14.mixed": "ch14_graphing_quadratics",
  "ch15.mixed": "ch15_more_inequalities",
  "ch16.mixed": "ch16_functions",
  "ch17.mixed": "ch17_graphing_functions",
  "ch18.mixed": "ch18_polynomials",
  "ch19.mixed": "ch19_exp_logs",
  "ch20.mixed": "ch20_special_functions",
  "ch21.mixed": "ch21_sequences_series",
  "ch22.mixed": "ch22_special_manipulations",
};

// TODO(Checkpoint 19.4): Deploy only after the human confirms Edge Function deploy and host-driven round pacing.
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "POST") return json({ error: { code: "method_not_allowed" } }, 405);

  try {
    const context = await requireAuthedUser(request);
    if (context instanceof Response) return context;

    const body = await parseJsonBody(request);
    const sessionId = assertString(body.session_id, "session_id");
    const session = await requireHostSession(context.service, sessionId, context.user.id);
    const players = await context.service
      .from("session_players")
      .select("user_id")
      .eq("session_id", sessionId);

    if (players.error) throw new Error(players.error.message);
    const playerCount = players.data?.length ?? 0;
    if (session.mode === "mp" && (playerCount < 2 || playerCount > 8)) {
      return json({ error: { code: "invalid_player_count", message: "Multiplayer requires 2 to 8 players" } }, 409);
    }

    const config = session.config ?? {};
    const difficulty = String(config.difficulty ?? "medium").toLowerCase();
    const roundCount = Number(config.roundCount ?? config.round_count ?? 10);
    if (!Number.isInteger(roundCount) || roundCount <= 0) {
      return json({ error: { code: "invalid_round_count", message: "roundCount must be positive" } }, 400);
    }

    const existingRounds = await context.service
      .from("session_rounds")
      .select("round_index")
      .eq("session_id", sessionId);
    if (existingRounds.error) throw new Error(existingRounds.error.message);

    const existingRoundCount = existingRounds.data?.length ?? 0;
    if (existingRoundCount >= roundCount) {
      await broadcastRoomEvent(context.service, session.room_code, "game_start", {
        session_id: sessionId,
        round_count: roundCount,
      });
      return json({ session_id: sessionId, round_count: roundCount, reused_existing_rounds: true });
    }
    if (existingRoundCount > 0) {
      return json({ error: { code: "partial_round_set", message: "Session has a partial round set and cannot be restarted safely" } }, 409);
    }

    const requestedTopics = Array.isArray(config.topicIds)
      ? config.topicIds.map(String).filter(Boolean)
      : [];
    const topicIds = requestedTopics.filter((topic: string) => !topic.endsWith(".mixed"));
    const groupIds = requestedTopics
      .filter((topic: string) => topic.endsWith(".mixed"))
      .map((topic: string) => MIXED_TOPIC_GROUPS[topic])
      .filter(Boolean);

    const problems = await loadCandidateProblems(context.service, difficulty, topicIds, groupIds);
    const selected = shuffle(problems ?? []).slice(0, roundCount);
    if (selected.length < roundCount) {
      return json({ error: { code: "not_enough_problems", message: "Problem bank does not have enough valid problems for this config" } }, 409);
    }

    const fixedDurationMs = Number(config.fixedDurationSec ?? config.fixed_duration_sec ?? 0) * 1000;
    const useFixedTimer = config.timerMode === "fixed" && fixedDurationMs > 0;
    const rows = selected.map((problem: any, index: number) => ({
      session_id: sessionId,
      round_index: index,
      problem_id: problem.id,
      duration_ms: useFixedTimer ? fixedDurationMs : roundDurationMs(problem.difficulty, Number(problem.complexity_factor ?? 1)),
    }));

    const { error: roundsError } = await context.service
      .from("session_rounds")
      .upsert(rows, { onConflict: "session_id,round_index" });
    if (roundsError) throw new Error(roundsError.message);

    const { error: sessionError } = await context.service
      .from("game_sessions")
      .update({ state: "countdown" })
      .eq("id", sessionId);
    if (sessionError) throw new Error(sessionError.message);

    if (session.room_code) {
      await context.service.from("rooms").update({ status: "in_game", config }).eq("code", session.room_code);
    }

    await broadcastRoomEvent(context.service, session.room_code, "game_start", {
      session_id: sessionId,
      round_count: roundCount,
    });

    return json({ session_id: sessionId, round_count: roundCount });
  } catch (error) {
    return handleError(error);
  }
});

async function loadCandidateProblems(service: any, difficulty: string, topicIds: string[], groupIds: string[]) {
  const select = "id, topic_id, group_id, difficulty, prompt_latex, answer_format, choices, complexity_factor";
  const requests: Promise<any>[] = [];

  if (topicIds.length > 0) {
    requests.push(service.from("problems").select(select).eq("status", "valid").eq("difficulty", difficulty).in("topic_id", topicIds).limit(1000));
  }

  if (groupIds.length > 0) {
    requests.push(service.from("problems").select(select).eq("status", "valid").eq("difficulty", difficulty).in("group_id", groupIds).limit(1000));
  }

  if (requests.length === 0) {
    requests.push(service.from("problems").select(select).eq("status", "valid").eq("difficulty", difficulty).limit(1000));
  }

  const responses = await Promise.all(requests);
  const byId = new Map<string, any>();
  for (const response of responses) {
    if (response.error) throw new Error(response.error.message);
    for (const problem of response.data ?? []) byId.set(problem.id, problem);
  }
  return Array.from(byId.values());
}
