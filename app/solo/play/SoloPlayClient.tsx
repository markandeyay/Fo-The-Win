"use client";

import { useEffect, useReducer, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  sessionMachineReducer,
  initialSessionState,
  type Problem,
} from "@/lib/sessionMachine";
import { computeRoundPoints } from "@/lib/scoring";
import { ProblemCanvas } from "@/components/ProblemCanvas";
import { TimerRing } from "@/components/TimerRing";
import { Scoreboard } from "@/components/Scoreboard";
import { MixedKatex } from "@/components/MixedKatex";

export default function SoloPlayClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const topicId = searchParams.get("topic_id");
  const difficulty = searchParams.get("difficulty") || "easy";
  const rounds = parseInt(searchParams.get("rounds") || "5", 10);

  const [state, dispatch] = useReducer(sessionMachineReducer, initialSessionState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);

  // Load problems
  useEffect(() => {
    if (!topicId) {
      router.replace("/solo");
      return;
    }

    async function load() {
      try {
        const res = await fetch(
          `/api/problems?topic_id=${encodeURIComponent(topicId!)}&difficulty=${difficulty}`
        );
        const data = await res.json();
        const problems: Problem[] = (data.problems || [])
          .sort(() => Math.random() - 0.5)
          .slice(0, rounds);
        if (problems.length === 0) {
          setError("No problems found for this topic and difficulty.");
          setLoading(false);
          return;
        }
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
  }, [topicId, difficulty, rounds, router]);

  // Countdown
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

  // Timer during question
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

  const handleAnswer = useCallback(
    (choiceId: string) => {
      if (state.status !== "question_active") return;
      const problem = state.problems[state.roundIndex];
      const correct = choiceId === problem.correct_choice;
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
    [state]
  );

  const totalScore = state.results.reduce((sum, r) => sum + r.points, 0);
  const correctCount = state.results.filter((r) => r.correct).length;

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
      <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-6">
        <h1 className="text-4xl font-bold text-ftw-accent">Session Complete</h1>
        <div className="bg-ftw-panel border border-gray-700 rounded-2xl p-8 shadow-xl text-center min-w-[18rem]">
          <div className="text-5xl font-black">{totalScore}</div>
          <div className="text-ftw-muted mt-2">Total Score</div>
          <div className="mt-4 text-xl">
            {correctCount} / {state.problems.length} correct
          </div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => router.push("/solo")}
            className="rounded-xl bg-ftw-panel border border-ftw-accent px-6 py-3 font-semibold hover:bg-ftw-accent hover:text-ftw-dark transition"
          >
            Play Again
          </button>
          <button
            onClick={() => router.push("/")}
            className="rounded-xl bg-ftw-panel border border-gray-600 px-6 py-3 font-semibold hover:border-ftw-text transition"
          >
            Home
          </button>
        </div>
      </main>
    );
  }

  const problem = state.problems[state.roundIndex];
  const currentResult = state.results[state.roundIndex];

  return (
    <main className="min-h-screen flex flex-col items-center p-4 md:p-8 gap-6">
      <div className="w-full flex items-center justify-between max-w-4xl">
        <Scoreboard
          score={totalScore}
          roundIndex={state.roundIndex}
          roundCount={state.problems.length}
        />
        <TimerRing durationMs={state.roundDurationMs} remainingMs={remainingMs} />
      </div>

      {state.status === "question_active" && (
        <ProblemCanvas problem={problem} onAnswer={handleAnswer} />
      )}

      {state.status === "question_reveal" && currentResult && (
        <div className="flex flex-col items-center gap-6 w-full max-w-2xl">
          <div
            className={`text-3xl font-bold ${
              currentResult.correct ? "text-ftw-success" : "text-ftw-danger"
            }`}
          >
            {currentResult.correct ? "Correct!" : "Time's up / Wrong"} +
            {currentResult.points}
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
