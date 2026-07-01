import {
  assertString,
  assignPlacements,
  broadcastRoomEvent,
  computeRatingDeltas,
  daysBetweenDates,
  handleError,
  json,
  levelForXp,
  loadSessionPlayers,
  localDateString,
  optionsResponse,
  parseJsonBody,
  remainingFraction,
  requireAuthedUser,
  requireHostSession,
} from "../_shared/game.ts";

const XP_BY_DIFFICULTY: Record<string, number> = { easy: 10, medium: 20, hard: 35 };
const COMPLETION_XP_BONUS = 25;

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
    const players = await loadSessionPlayers(context.service, sessionId);

    const placements = assignPlacements(players.map((player: any) => ({
      userId: player.user_id,
      score: Number(player.score ?? 0),
      correctCount: Number(player.correct_count ?? 0),
      totalTimeMs: Number(player.total_time_ms ?? 0),
    })));

    await Promise.all(placements.map((row) => context.service
      .from("session_players")
      .update({ placement: row.placement })
      .eq("session_id", sessionId)
      .eq("user_id", row.userId)));

    const userIds = placements.map((row) => row.userId);
    const { data: profiles, error: profilesError } = await context.service
      .from("profiles")
      .select("id, rating, xp, level, timezone")
      .in("id", userIds);
    if (profilesError) throw new Error(profilesError.message);
    const profilesById = new Map<string, any>((profiles ?? []).map((profile: any) => [profile.id, profile]));

    let ratingDelta: unknown[] = [];
    if (session.ranked && session.mode === "mp") {
      const ratedPlayers = await Promise.all(placements.map(async (row) => {
        const profile = profilesById.get(row.userId) ?? { rating: 1200 };
        const { count, error } = await context.service
          .from("rating_events")
          .select("id", { count: "exact", head: true })
          .eq("user_id", row.userId);
        if (error) throw new Error(error.message);
        return {
          id: row.userId,
          rating: Number(profile.rating ?? 1200),
          gamesPlayed: count ?? 0,
          placement: row.placement ?? placements.length,
        };
      }));

      ratingDelta = computeRatingDeltas(ratedPlayers);
      await Promise.all((ratingDelta as any[]).map((delta) => context.service
        .from("profiles")
        .update({ rating: delta.newRating })
        .eq("id", delta.id)));
      await context.service.from("rating_events").insert((ratingDelta as any[]).map((delta) => ({
        user_id: delta.id,
        session_id: sessionId,
        delta: delta.delta,
        new_rating: delta.newRating,
      })));
    }

    const { data: rounds, error: roundsError } = await context.service
      .from("session_rounds")
      .select("round_index, duration_ms, problem_id")
      .eq("session_id", sessionId);
    if (roundsError) throw new Error(roundsError.message);

    const problemIds = [...new Set((rounds ?? []).map((round: any) => round.problem_id).filter(Boolean))];
    const { data: problems, error: problemsError } = problemIds.length > 0
      ? await context.service
        .from("problems")
        .select("id, topic_id, difficulty")
        .in("id", problemIds)
      : { data: [], error: null };
    if (problemsError) throw new Error(problemsError.message);

    const problemById = new Map<string, any>((problems ?? []).map((problem: any) => [problem.id, problem]));
    const roundByIndex = new Map<number, any>((rounds ?? []).map((round: any) => [round.round_index, round]));

    const { data: answers, error: answersError } = await context.service
      .from("round_answers")
      .select("user_id, round_index, is_correct, time_ms")
      .eq("session_id", sessionId);
    if (answersError) throw new Error(answersError.message);

    const xpDelta: Record<string, number> = {};
    const streakDelta: Record<string, unknown> = {};
    for (const userId of userIds) {
      const userAnswers = (answers ?? []).filter((answer: any) => answer.user_id === userId);
      const earnedXp = userAnswers.reduce((sum: number, answer: any) => {
        if (!answer.is_correct) return sum;
        const round = roundByIndex.get(answer.round_index);
        const problem = round ? problemById.get(round.problem_id) : null;
        return sum + (XP_BY_DIFFICULTY[String(problem?.difficulty ?? session.config?.difficulty ?? "medium")] ?? 20);
      }, COMPLETION_XP_BONUS);
      xpDelta[userId] = earnedXp;

      const profile = profilesById.get(userId) ?? { xp: 0, timezone: "UTC" };
      const nextXp = Number(profile.xp ?? 0) + earnedXp;
      await context.service.from("profiles").update({ xp: nextXp, level: levelForXp(nextXp) }).eq("id", userId);

      const { data: streak } = await context.service
        .from("streaks")
        .select("current_streak, longest_streak, last_played_date, freeze_tokens")
        .eq("user_id", userId)
        .maybeSingle();

      const today = localDateString(new Date(), String(profile.timezone ?? "UTC"));
      const updatedStreak = updateStreak(streak, today);
      streakDelta[userId] = updatedStreak;
      await context.service.from("streaks").upsert({ user_id: userId, ...updatedStreak }, { onConflict: "user_id" });

      await Promise.all(userAnswers.map((answer: any) => updateTopicStats(context.service, userId, answer, roundByIndex, problemById)));
    }

    await context.service
      .from("game_sessions")
      .update({ state: "results", ended_at: new Date().toISOString() })
      .eq("id", sessionId);

    const payload = {
      final_scoreboard: placements,
      rating_delta: ratingDelta,
      xp_delta: xpDelta,
      streak_delta: streakDelta,
    };
    await broadcastRoomEvent(context.service, session.room_code, "game_end", payload);
    return json(payload);
  } catch (error) {
    return handleError(error);
  }
});

function updateStreak(streak: any, today: string) {
  if (!streak?.last_played_date) {
    return { current_streak: 1, longest_streak: 1, last_played_date: today, freeze_tokens: Number(streak?.freeze_tokens ?? 0) };
  }

  const previous = String(streak.last_played_date);
  if (previous === today) {
    return {
      current_streak: Number(streak.current_streak ?? 0),
      longest_streak: Number(streak.longest_streak ?? 0),
      last_played_date: today,
      freeze_tokens: Number(streak.freeze_tokens ?? 0),
    };
  }

  const gap = daysBetweenDates(previous, today);
  let current = Number(streak.current_streak ?? 0);
  let freezes = Number(streak.freeze_tokens ?? 0);
  if (gap === 1) current += 1;
  else if (gap === 2 && freezes > 0) {
    freezes -= 1;
    current += 1;
  } else current = 1;

  const earnedFreeze = current > 0 && current % 7 === 0 ? 1 : 0;
  freezes = Math.min(2, freezes + earnedFreeze);
  return {
    current_streak: current,
    longest_streak: Math.max(Number(streak.longest_streak ?? 0), current),
    last_played_date: today,
    freeze_tokens: freezes,
  };
}

async function updateTopicStats(service: any, userId: string, answer: any, roundByIndex: Map<number, any>, problemById: Map<string, any>) {
  const round = roundByIndex.get(answer.round_index);
  const problem = round ? problemById.get(round.problem_id) : null;
  if (!problem?.topic_id) return;

  const { data: current, error } = await service
    .from("user_topic_stats")
    .select("attempts, correct, avg_time_ms, mastery")
    .eq("user_id", userId)
    .eq("topic_id", problem.topic_id)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const attempts = Number(current?.attempts ?? 0);
  const correct = Number(current?.correct ?? 0);
  const avgTime = Number(current?.avg_time_ms ?? 0);
  const timeMs = Number(answer.time_ms ?? 0);
  const nextAttempts = attempts + 1;
  const nextCorrect = correct + (answer.is_correct ? 1 : 0);
  const nextAvgTime = Math.round((avgTime * attempts + timeMs) / nextAttempts);
  const learningRate = Math.max(2, 8 - Math.floor(attempts / 10));
  const speedNudge = answer.is_correct ? 0.1 * remainingFraction(Number(round.duration_ms ?? 1), timeMs) : 0;
  const outcome = answer.is_correct ? 1 + speedNudge : 0;
  const mastery = Number(current?.mastery ?? 0);
  const nextMastery = Math.max(0, Math.min(100, mastery + learningRate * (outcome - mastery / 100)));

  await service.from("user_topic_stats").upsert({
    user_id: userId,
    topic_id: problem.topic_id,
    attempts: nextAttempts,
    correct: nextCorrect,
    avg_time_ms: nextAvgTime,
    mastery: Number(nextMastery.toFixed(2)),
  }, { onConflict: "user_id,topic_id" });
}
