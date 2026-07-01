"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  sessionMachineReducer,
  initialSessionState,
  type Problem,
  type RoundResult,
} from "@/lib/sessionMachine";
import { comparePlayerResults, computeRoundPoints, type PlayerResult } from "@/lib/scoring";
import { answersEquivalent } from "@/lib/normalizeAnswer";
import { ProblemCanvas } from "@/components/ProblemCanvas";
import { TimerRing } from "@/components/TimerRing";
import { Scoreboard } from "@/components/Scoreboard";
import { MixedKatex } from "@/components/MixedKatex";

type BotId = "rookie" | "regular" | "sharp";

interface BotProfile {
  id: BotId;
  name: string;
  targetAccuracy: number;
  meanFraction: number;
  standardDeviation: number;
}

interface BotRoundResult extends RoundResult {
  botId: BotId;
  botName: string;
  submittedAnswer: string;
}

type Standing = PlayerResult & { displayName: string };

const BOT_PROFILES: Record<BotId, BotProfile> = {
  rookie: {
    id: "rookie",
    name: "Rookie",
    targetAccuracy: 0.55,
    meanFraction: 0.78,
    standardDeviation: 0.16,
  },
  regular: {
    id: "regular",
    name: "Regular",
    targetAccuracy: 0.75,
    meanFraction: 0.58,
    standardDeviation: 0.14,
  },
  sharp: {
    id: "sharp",
    name: "Sharp",
    targetAccuracy: 0.9,
    meanFraction: 0.38,
    standardDeviation: 0.12,
  },
};

const DIFFICULTY_DRAG: Record<string, number> = {
  easy: 0.92,
  medium: 1,
  hard: 1.12,
};

function formatTime(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function sampleNormal(mean: number, standardDeviation: number): number {
  const u1 = Math.max(Number.EPSILON, Math.random());
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * standardDeviation;
}

function sampleBotElapsedMs(profile: BotProfile, difficulty: string, durationMs: number): number {
  const drag = DIFFICULTY_DRAG[difficulty] ?? 1;
  const mean = profile.meanFraction * drag;
  let fraction = mean;
  for (let i = 0; i < 8; i++) {
    const sampled = sampleNormal(mean, profile.standardDeviation);
    if (sampled >= 0.08 && sampled <= 0.96) {
      fraction = sampled;
      break;
    }
  }
  const minMs = Math.min(900, durationMs);
  const maxMs = Math.max(minMs, durationMs - 150);
  return Math.max(minMs, Math.min(maxMs, Math.round(durationMs * fraction)));
}

function makeBotRoundResult(
  profile: BotProfile,
  problem: Problem,
  difficulty: string,
  durationMs: number
): BotRoundResult {
  const timeMs = sampleBotElapsedMs(profile, difficulty, durationMs);
  const correct = Math.random() < profile.targetAccuracy;
  const remainingFraction = durationMs > 0 ? 1 - timeMs / durationMs : 0;
  const points = computeRoundPoints({ correct, remainingFraction });
  const distractors = problem.choices?.filter((choice) => choice.id !== problem.correct_choice) ?? [];
  const distractor = distractors[Math.floor(Math.random() * distractors.length)];

  return {
    botId: profile.id,
    botName: profile.name,
    problemId: problem.id,
    correct,
    points,
    timeMs,
    submittedAnswer: correct ? problem.correct_answer : distractor?.latex ?? "miss",
  };
}

function summarizeResults(userId: string, displayName: string, results: RoundResult[]): Standing {
  return {
    userId,
    displayName,
    score: results.reduce((sum, result) => sum + result.points, 0),
    correctCount: results.filter((result) => result.correct).length,
    totalTimeMs: results.reduce(
      (sum, result) => sum + (result.correct ? result.timeMs : 0),
      0
    ),
  };
}

function StandingsTable({ standings }: { standings: Standing[] }) {
  return (
    <div className="w-full rounded-2xl border border-gray-700 bg-ftw-panel p-4 shadow-lg">
      <div className="mb-3 text-sm uppercase tracking-[0.25em] text-ftw-muted">Standings</div>
      <div className="space-y-2">
        {standings.map((standing, index) => (
          <div
            key={standing.userId}
            className="grid grid-cols-[2rem_1fr_4rem_4rem] items-center gap-3 rounded-xl bg-gray-950/40 px-3 py-2 text-sm"
          >
            <div className="font-black text-ftw-accent">#{index + 1}</div>
            <div className="font-semibold">{standing.displayName}</div>
            <div className="text-right font-bold">{standing.score}</div>
            <div className="text-right text-ftw-muted">{standing.correctCount} ok</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SoloPlayClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const topicParam = searchParams.get("topic_ids") ?? searchParams.get("topic_id");
  const difficulty = searchParams.get("difficulty") || "easy";
  const rounds = Math.max(1, parseInt(searchParams.get("rounds") || "5", 10) || 5);
  const botParam = searchParams.get("bots") || "";
  const runId = searchParams.get("run") || "";
  const answerMode = searchParams.get("answer_mode") === "free" ? "free" : "mc";

  const botIds = useMemo(
    () =>
      botParam
        .split(",")
        .filter((id): id is BotId => id in BOT_PROFILES),
    [botParam]
  );
  const botKey = botIds.join(",");

  const [state, dispatch] = useReducer(sessionMachineReducer, initialSessionState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [botResults, setBotResults] = useState<Record<string, BotRoundResult[]>>({});
  const [sessionStartedMs, setSessionStartedMs] = useState(0);
  const [sessionFinishedMs, setSessionFinishedMs] = useState(0);
  const plannedBotRounds = useRef<Record<string, BotRoundResult[]>>({});

  useEffect(() => {
    if (!topicParam) {
      router.replace("/solo");
      return;
    }

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({ difficulty });
        params.set("topic_ids", topicParam!);
        const res = await fetch(`/api/problems?${params.toString()}`);
        const data = await res.json();
        const problems: Problem[] = (data.problems || [])
          .sort(() => Math.random() - 0.5)
          .slice(0, rounds);
        if (problems.length === 0) {
          setError("No problems found for the selected topics and difficulty.");
          setLoading(false);
          return;
        }
        plannedBotRounds.current = {};
        setBotResults(Object.fromEntries(botIds.map((id) => [id, []])));
        setSessionStartedMs(Date.now());
        setSessionFinishedMs(0);
        dispatch({
          type: "START_SESSION",
          config: { mode: "solo", roundCount: problems.length, difficulty },
          problems,
        });
        setLoading(false);
      } catch {
        setError("Failed to load problems.");
        setLoading(false);
      }
    }
    load();
  }, [topicParam, difficulty, rounds, router, runId, botKey]);

  useEffect(() => {
    if (state.status !== "countdown") return;
    let count = 3;
    const interval = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(interval);
        dispatch({ type: "START_QUESTION" });
      }
    }, 800);
    return () => clearInterval(interval);
  }, [state.status]);

  useEffect(() => {
    if (state.status !== "question_active") return;
    setRemainingMs(state.roundDurationMs);
    const interval = setInterval(() => {
      const elapsed = Date.now() - state.roundStartMs;
      const left = Math.max(0, state.roundDurationMs - elapsed);
      setRemainingMs(left);
      if (left <= 0) {
        clearInterval(interval);
        dispatch({ type: "REVEAL_ROUND" });
      }
    }, 50);
    return () => clearInterval(interval);
  }, [state.status, state.roundStartMs, state.roundDurationMs]);

  useEffect(() => {
    if (state.status !== "question_active" || botIds.length === 0) return;
    const problem = state.problems[state.roundIndex];
    const key = `${state.roundIndex}:${problem.id}`;
    if (plannedBotRounds.current[key]) return;
    plannedBotRounds.current[key] = botIds.map((botId) =>
      makeBotRoundResult(
        BOT_PROFILES[botId],
        problem,
        state.config.difficulty,
        state.roundDurationMs
      )
    );
  }, [botIds, state.config.difficulty, state.problems, state.roundDurationMs, state.roundIndex, state.status]);

  useEffect(() => {
    if (state.status !== "question_reveal" || botIds.length === 0) return;
    const problem = state.problems[state.roundIndex];
    const key = `${state.roundIndex}:${problem.id}`;
    const planned = plannedBotRounds.current[key] ?? [];
    if (planned.length === 0) return;

    setBotResults((current) => {
      let changed = false;
      const next = { ...current };
      for (const result of planned) {
        const existing = next[result.botId] ?? [];
        if (existing.some((round) => round.problemId === result.problemId)) continue;
        next[result.botId] = [...existing, result];
        changed = true;
      }
      return changed ? next : current;
    });
  }, [botIds.length, state.problems, state.roundIndex, state.status]);

  useEffect(() => {
    if (state.status === "results" && sessionFinishedMs === 0) {
      setSessionFinishedMs(Date.now());
    }
  }, [sessionFinishedMs, state.status]);

  const handleAnswer = useCallback(
    (answer: string) => {
      if (state.status !== "question_active") return;
      const problem = state.problems[state.roundIndex];
      const useFreeEntry = answerMode === "free" || problem.answer_format !== "mc";
      const correct = useFreeEntry
        ? answersEquivalent(
            answer,
            problem.correct_answer,
            problem.answer_type,
            problem.accepted_forms
          )
        : answer === problem.correct_choice;
      const elapsed = Date.now() - state.roundStartMs;
      const fraction = state.roundDurationMs > 0 ? 1 - elapsed / state.roundDurationMs : 0;
      const points = computeRoundPoints({ correct, remainingFraction: fraction });
      dispatch({
        type: "SUBMIT_ANSWER",
        correct,
        timeMs: elapsed,
        points,
      });
    },
    [answerMode, state]
  );

  const totalScore = state.results.reduce((sum, result) => sum + result.points, 0);
  const correctCount = state.results.filter((result) => result.correct).length;
  const accuracy = state.problems.length > 0 ? Math.round((correctCount / state.problems.length) * 100) : 0;
  const correctSolveTimeMs = state.results.reduce(
    (sum, result) => sum + (result.correct ? result.timeMs : 0),
    0
  );
  const elapsedSessionMs = Math.max(
    0,
    (sessionFinishedMs || Date.now()) - (sessionStartedMs || Date.now())
  );

  const standings = useMemo(() => {
    const rows: Standing[] = [summarizeResults("you", "You", state.results)];
    for (const botId of botIds) {
      rows.push(summarizeResults(botId, BOT_PROFILES[botId].name, botResults[botId] ?? []));
    }
    return rows.sort(comparePlayerResults);
  }, [botIds, botResults, state.results]);
  const scoreboardPlayers = botIds.length > 0
    ? standings.map((standing) => {
        const rounds = standing.userId === "you" ? state.results : botResults[standing.userId] ?? [];
        const lastRound = rounds[rounds.length - 1];
        return {
          id: standing.userId,
          name: standing.displayName,
          score: standing.score,
          correctCount: standing.correctCount,
          delta: lastRound?.points,
          isLocal: standing.userId === "you",
        };
      })
    : undefined;

  function rematch() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("run", Date.now().toString());
    router.push(`/solo/play?${params.toString()}`);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-ftw-muted">
        Loading problems...
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 text-ftw-danger">
        <p>{error}</p>
        <button
          onClick={() => router.push("/solo")}
          className="rounded-lg bg-ftw-panel px-4 py-2 border border-gray-600 hover:border-ftw-accent"
        >
          Back
        </button>
      </main>
    );
  }

  if (state.status === "idle") return null;

  if (state.status === "countdown") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-6">
        <div className="text-6xl font-black text-ftw-accent animate-pulse">Ready?</div>
        <p className="text-ftw-muted">Starting in a moment...</p>
      </main>
    );
  }

  if (state.status === "results") {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1f2937_0%,#0b0f19_48%)] p-4 text-ftw-text md:p-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <header className="rounded-3xl border border-amber-500/30 bg-ftw-panel/90 p-6 shadow-xl">
            <p className="text-sm uppercase tracking-[0.35em] text-ftw-accent">Results</p>
            <h1 className="mt-2 text-4xl font-black">Session Complete</h1>
          </header>

          <section className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-gray-700 bg-ftw-panel p-5 text-center">
              <div className="text-4xl font-black text-ftw-accent">{totalScore}</div>
              <div className="mt-1 text-sm text-ftw-muted">Final score</div>
            </div>
            <div className="rounded-2xl border border-gray-700 bg-ftw-panel p-5 text-center">
              <div className="text-4xl font-black">{accuracy}%</div>
              <div className="mt-1 text-sm text-ftw-muted">Accuracy</div>
            </div>
            <div className="rounded-2xl border border-gray-700 bg-ftw-panel p-5 text-center">
              <div className="text-4xl font-black">{formatTime(elapsedSessionMs)}</div>
              <div className="mt-1 text-sm text-ftw-muted">Total time</div>
            </div>
            <div className="rounded-2xl border border-gray-700 bg-ftw-panel p-5 text-center">
              <div className="text-4xl font-black">{formatTime(correctSolveTimeMs)}</div>
              <div className="mt-1 text-sm text-ftw-muted">Correct solve time</div>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
            <section className="rounded-3xl border border-gray-700 bg-ftw-panel/90 p-5 shadow-xl">
              <h2 className="text-2xl font-bold">Per-round Breakdown</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[42rem] text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.2em] text-ftw-muted">
                    <tr>
                      <th className="py-2">Round</th>
                      <th className="py-2">Topic</th>
                      <th className="py-2">Result</th>
                      <th className="py-2 text-right">Time</th>
                      <th className="py-2 text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.results.map((result, index) => {
                      const problem = state.problems[index];
                      return (
                        <tr key={result.problemId} className="border-t border-gray-800">
                          <td className="py-3 font-bold">{index + 1}</td>
                          <td className="py-3 text-ftw-muted">{problem.topic_id ?? "local"}</td>
                          <td className={result.correct ? "py-3 text-ftw-success" : "py-3 text-ftw-danger"}>
                            {result.correct ? "Correct" : "Wrong or timeout"}
                          </td>
                          <td className="py-3 text-right">{formatTime(result.timeMs)}</td>
                          <td className="py-3 text-right font-bold">{result.points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <StandingsTable standings={standings} />
              <div className="flex flex-col gap-3 rounded-3xl border border-gray-700 bg-ftw-panel p-5 sm:flex-row">
                <button
                  onClick={rematch}
                  className="flex-1 rounded-xl bg-ftw-accent px-6 py-3 font-bold text-ftw-dark transition hover:bg-amber-400"
                >
                  Rematch
                </button>
                <button
                  onClick={() => router.push("/solo")}
                  className="flex-1 rounded-xl border border-ftw-accent px-6 py-3 font-bold transition hover:bg-ftw-accent hover:text-ftw-dark"
                >
                  Configure
                </button>
                <button
                  onClick={() => router.push("/")}
                  className="flex-1 rounded-xl border border-gray-600 px-6 py-3 font-bold transition hover:border-ftw-text"
                >
                  Home
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>
    );
  }

  const problem = state.problems[state.roundIndex];
  const currentResult = state.results[state.roundIndex];

  return (
    <main className="min-h-screen flex flex-col items-center p-4 md:p-8 gap-6">
      <div className="w-full flex flex-col gap-4 max-w-4xl md:flex-row md:items-center md:justify-between">
        <Scoreboard
          score={totalScore}
          roundIndex={state.roundIndex}
          roundCount={state.problems.length}
          players={scoreboardPlayers}
        />
        <TimerRing durationMs={state.roundDurationMs} remainingMs={remainingMs} />
      </div>

      {state.status === "question_active" && (
        <ProblemCanvas problem={problem} answerMode={answerMode} onAnswer={handleAnswer} />
      )}

      {state.status === "question_reveal" && currentResult && (
        <div className="flex flex-col items-center gap-6 w-full max-w-2xl">
          <div
            className={`text-3xl font-bold ${
              currentResult.correct ? "text-ftw-success" : "text-ftw-danger"
            }`}
          >
            {currentResult.correct ? "Correct!" : "Time's up or wrong"} +{currentResult.points}
          </div>

          <div className="bg-ftw-panel border border-gray-700 rounded-2xl p-6 w-full">
            <div className="text-sm text-ftw-muted mb-2">Answer</div>
            <div className="text-xl">
              <MixedKatex source={problem.correct_answer} />
            </div>
            <div className="mt-4 text-sm text-ftw-muted">Solution</div>
            <div className="text-lg leading-relaxed">
              <MixedKatex source={problem.solution_latex} />
            </div>
          </div>

          {botIds.length > 0 && (
            <div className="w-full rounded-2xl border border-gray-700 bg-ftw-panel p-4">
              <div className="mb-3 text-sm uppercase tracking-[0.2em] text-ftw-muted">Bot round</div>
              <div className="space-y-2">
                {botIds.map((botId) => {
                  const botRound = (botResults[botId] ?? []).find(
                    (result) => result.problemId === problem.id
                  );
                  return (
                    <div key={botId} className="flex items-center justify-between rounded-xl bg-gray-950/40 px-3 py-2 text-sm">
                      <span className="font-semibold">{BOT_PROFILES[botId].name}</span>
                      <span className={botRound?.correct ? "text-ftw-success" : "text-ftw-danger"}>
                        {botRound ? `${botRound.correct ? "Correct" : "Wrong"} +${botRound.points}` : "Thinking"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={() =>
              state.roundIndex + 1 >= state.problems.length
                ? dispatch({ type: "END_SESSION" })
                : dispatch({ type: "NEXT_ROUND" })
            }
            className="rounded-xl bg-ftw-accent text-ftw-dark font-bold px-8 py-3 hover:bg-amber-400 transition"
          >
            {state.roundIndex + 1 >= state.problems.length ? "View Results" : "Next Round"}
          </button>
        </div>
      )}
    </main>
  );
}
