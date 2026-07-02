"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TimerRing } from "@/components/TimerRing";
import {
  RACE_RESULTS_STORAGE_KEY,
  compareRaceResults,
  formatRaceTime,
  generateRaceProblem,
  getPersonalBest,
  normalizeRaceConfig,
  raceConfigKey,
  type RaceConfig,
  type RaceProblem,
  type RaceResult,
} from "@/lib/race";

type RaceStatus = "ready" | "countdown" | "active" | "finished";

interface AttemptLogEntry {
  index: number;
  prompt: string;
  submitted: string;
  correctAnswer: number;
  correct: boolean;
  elapsedMs: number;
}

function readStoredResults(): RaceResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RACE_RESULTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredResults(results: RaceResult[]) {
  window.localStorage.setItem(RACE_RESULTS_STORAGE_KEY, JSON.stringify(results.slice(0, 200)));
}

function resultFromSession(config: RaceConfig, correct: number, wrong: number, durationMs: number): RaceResult {
  const random = Math.random().toString(36).slice(2, 8);
  return {
    id: `race-${Date.now()}-${random}`,
    mode: config.mode,
    minFactor: config.minFactor,
    maxFactor: config.maxFactor,
    seed: config.seed,
    correct,
    wrong,
    durationMs,
    targetCorrect: config.targetCorrect,
    createdAt: new Date().toISOString(),
  };
}

function makeConfig(searchParams: ReturnType<typeof useSearchParams>): RaceConfig {
  return normalizeRaceConfig({
    minFactor: Number(searchParams.get("min") ?? 2),
    maxFactor: Number(searchParams.get("max") ?? 12),
    mode: searchParams.get("mode") === "first_to_n" ? "first_to_n" : "sprint",
    playerMode: searchParams.get("players") === "mp" ? "mp" : "solo",
    durationSec: Number(searchParams.get("duration") ?? 60),
    targetCorrect: Number(searchParams.get("target") ?? 20),
    seed: searchParams.get("seed") ?? undefined,
    roomCode: searchParams.get("room") ?? undefined,
  });
}

export default function RacePlayClient() {
  const searchParams = useSearchParams();
  const config = useMemo(() => makeConfig(searchParams), [searchParams]);
  const isMp = config.playerMode === "mp";
  const [status, setStatus] = useState<RaceStatus>("ready");
  const [countdown, setCountdown] = useState(3);
  const [problemIndex, setProblemIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [nowMs, setNowMs] = useState(0);
  const [startedMs, setStartedMs] = useState(0);
  const [finishedMs, setFinishedMs] = useState(0);
  const [attempts, setAttempts] = useState<AttemptLogEntry[]>([]);
  const [storedResults, setStoredResults] = useState<RaceResult[]>([]);
  const [savedResultId, setSavedResultId] = useState<string | null>(null);
  const [result, setResult] = useState<RaceResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const finishLockedRef = useRef(false);

  const currentProblem = useMemo<RaceProblem>(
    () => generateRaceProblem(config, problemIndex),
    [config, problemIndex]
  );
  const nextProblem = useMemo<RaceProblem>(
    () => generateRaceProblem(config, problemIndex + 1),
    [config, problemIndex]
  );

  const elapsedMs = status === "active" ? Math.max(0, nowMs - startedMs) : Math.max(0, finishedMs - startedMs);
  const sprintDurationMs = config.durationSec * 1000;
  const remainingMs = config.mode === "sprint" ? Math.max(0, sprintDurationMs - elapsedMs) : 0;
  const pace = elapsedMs > 0 ? correct / (elapsedMs / 60000) : 0;
  const sharePath = `/race/play?${searchParams.toString()}`;
  const configLabel = `${config.minFactor}-${config.maxFactor} ${config.mode === "sprint" ? `${config.durationSec}s sprint` : `first to ${config.targetCorrect}`}`;

  useEffect(() => {
    setStoredResults(readStoredResults());
  }, []);

  useEffect(() => {
    if (status !== "countdown") return;
    if (countdown <= 0) {
      const started = Date.now();
      setStartedMs(started);
      setNowMs(started);
      setStatus("active");
      return;
    }
    const timeout = window.setTimeout(() => setCountdown((value) => value - 1), 700);
    return () => window.clearTimeout(timeout);
  }, [countdown, status]);

  useEffect(() => {
    if (status !== "active") return;
    const interval = window.setInterval(() => {
      const nextNow = Date.now();
      setNowMs(nextNow);
      if (config.mode === "sprint" && nextNow - startedMs >= sprintDurationMs) {
        finishRace(sprintDurationMs);
      }
    }, 40);
    return () => window.clearInterval(interval);
  }, [config.mode, correct, sprintDurationMs, startedMs, status, wrong]);

  useEffect(() => {
    if (status === "active") {
      inputRef.current?.focus();
    }
  }, [currentProblem.index, status]);

  useEffect(() => {
    if (!result || isMp || savedResultId === result.id) return;
    const nextResults = [result, ...storedResults].sort(compareRaceResults).slice(0, 200);
    writeStoredResults(nextResults);
    setStoredResults(nextResults);
    setSavedResultId(result.id);
  }, [isMp, result, savedResultId, storedResults]);

  function startSolo() {
    if (isMp) return;
    finishLockedRef.current = false;
    setStatus("countdown");
    setCountdown(3);
    setProblemIndex(0);
    setAnswer("");
    setCorrect(0);
    setWrong(0);
    setFeedback(null);
    setStartedMs(0);
    setFinishedMs(0);
    setNowMs(0);
    setAttempts([]);
    setResult(null);
    setSavedResultId(null);
  }

  function finishRace(forcedDurationMs?: number, finalCorrect = correct, finalWrong = wrong) {
    if (finishLockedRef.current) return;
    finishLockedRef.current = true;
    const finished = Date.now();
    const measuredDuration = forcedDurationMs ?? Math.max(0, finished - startedMs);
    setFinishedMs(startedMs + measuredDuration);
    setResult(resultFromSession(config, finalCorrect, finalWrong, measuredDuration));
    setAnswer("");
    setStatus("finished");
  }

  function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status !== "active") return;

    const trimmed = answer.trim();
    if (!trimmed) return;
    const submitted = Number(trimmed);
    const isCorrect = Number.isInteger(submitted) && submitted === currentProblem.answer;
    const attemptElapsed = Math.max(0, Date.now() - startedMs);

    setAttempts((current) => [
      {
        index: currentProblem.index,
        prompt: `${currentProblem.a} x ${currentProblem.b}`,
        submitted: trimmed,
        correctAnswer: currentProblem.answer,
        correct: isCorrect,
        elapsedMs: attemptElapsed,
      },
      ...current.slice(0, 17),
    ]);

    if (isCorrect) {
      const nextCorrect = correct + 1;
      setCorrect(nextCorrect);
      setProblemIndex((index) => index + 1);
      setFeedback("correct");
      setAnswer("");
      if (config.mode === "first_to_n" && nextCorrect >= config.targetCorrect) {
        finishRace(attemptElapsed, nextCorrect, wrong);
      }
      window.setTimeout(() => setFeedback(null), 220);
      return;
    }

    setWrong((count) => count + 1);
    setFeedback("wrong");
    setAnswer("");
    window.setTimeout(() => setFeedback(null), 260);
  }

  const configResults = useMemo(
    () =>
      storedResults
        .filter((stored) => result ? raceConfigKey(stored) === raceConfigKey(result) : stored.mode === config.mode && stored.minFactor === config.minFactor && stored.maxFactor === config.maxFactor)
        .sort(compareRaceResults)
        .slice(0, 8),
    [config.maxFactor, config.minFactor, config.mode, result, storedResults]
  );

  const personalBest = result ? getPersonalBest(storedResults, result) : null;
  const newPersonalBest = Boolean(result && personalBest?.id === result.id);

  if (isMp) {
    return (
      <main className="ftw-page-shell min-h-screen p-4 text-ftw-text md:p-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col justify-center gap-6">
          <section className="ftw-card p-8">
            <p className="ftw-label text-ftw-info">MP Race Seed Room</p>
            <h1 className="ftw-display mt-3 text-5xl">Seed Room {config.roomCode || "LOCAL"}</h1>
            <p className="mt-4 max-w-2xl text-ftw-muted">
              This path shares a deterministic seed and config for fair multiplayer setup. It does not self-score on the client because competitive Race MP must use server-authoritative timing and scoring.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="ftw-card-sm p-4">
                <div className="ftw-label text-ftw-muted">Seed</div>
                <div className="ftw-number mt-2 break-all text-xl text-ftw-success">{config.seed}</div>
              </div>
              <div className="ftw-card-sm p-4">
                <div className="ftw-label text-ftw-muted">Config</div>
                <div className="mt-2 text-xl font-black">{configLabel}</div>
              </div>
              <div className="ftw-card-sm p-4">
                <div className="ftw-label text-ftw-muted">First Problem</div>
                <div className="mt-2 text-xl font-black">{currentProblem.a} x {currentProblem.b}</div>
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-ftw-info/40 bg-ftw-info/10 p-4">
              <div className="text-sm font-bold text-ftw-info">Share path</div>
              <div className="mt-2 break-all font-mono text-sm text-ftw-muted">{sharePath}</div>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/race" className="flex-1 rounded-xl border border-ftw-info bg-ftw-info/10 px-6 py-3 text-center font-black text-ftw-info transition hover:bg-ftw-info hover:text-ftw-panel">
                Back to Race Config
              </Link>
              <Link href="/" className="ftw-button-secondary flex-1 text-center">
                Home
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (status === "countdown") {
    return (
      <main className="ftw-page-shell flex min-h-screen flex-col items-center justify-center gap-5 text-ftw-text">
        <p className="ftw-label text-ftw-success">Race starts in</p>
        <div className="ftw-display animate-pulse text-8xl text-ftw-accent">{countdown || "GO"}</div>
      </main>
    );
  }

  if (status === "finished" && result) {
    return (
      <main className="ftw-page-shell min-h-screen p-4 text-ftw-text md:p-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <header className="ftw-card p-6">
            <p className="ftw-label text-ftw-success">Race Results</p>
            <h1 className="ftw-display mt-2 text-5xl">{newPersonalBest ? "New Personal Best" : "Run Complete"}</h1>
            <p className="mt-2 text-ftw-muted">{configLabel}, seed {config.seed}</p>
          </header>

          <section className="grid gap-4 md:grid-cols-4">
            <div className="ftw-card-sm p-5 text-center">
              <div className="ftw-number text-5xl text-ftw-success">{result.correct}</div>
              <div className="mt-1 text-sm text-ftw-muted">Correct</div>
            </div>
            <div className="ftw-card-sm p-5 text-center">
              <div className="ftw-number text-5xl text-ftw-danger">{result.wrong}</div>
              <div className="mt-1 text-sm text-ftw-muted">Wrong attempts</div>
            </div>
            <div className="ftw-card-sm p-5 text-center">
              <div className="ftw-number text-5xl">{formatRaceTime(result.durationMs)}</div>
              <div className="mt-1 text-sm text-ftw-muted">Duration</div>
            </div>
            <div className="ftw-card-sm p-5 text-center">
              <div className="ftw-number text-5xl text-ftw-accent">{pace.toFixed(1)}</div>
              <div className="mt-1 text-sm text-ftw-muted">Correct per min</div>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
            <section className="ftw-card p-5">
              <h2 className="font-serif text-2xl font-black">Attempt Log</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[38rem] text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.2em] text-ftw-muted">
                    <tr>
                      <th className="py-2">Problem</th>
                      <th className="py-2">Submitted</th>
                      <th className="py-2">Answer</th>
                      <th className="py-2">Result</th>
                      <th className="py-2 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-5 text-ftw-muted">No attempts recorded.</td>
                      </tr>
                    )}
                    {attempts.map((attempt) => (
                      <tr key={`${attempt.index}-${attempt.elapsedMs}-${attempt.submitted}`} className="border-t border-ftw-line">
                        <td className="py-3 font-bold">{attempt.prompt}</td>
                        <td className="py-3">{attempt.submitted}</td>
                        <td className="py-3">{attempt.correctAnswer}</td>
                        <td className={attempt.correct ? "py-3 text-ftw-success" : "py-3 text-ftw-danger"}>
                          {attempt.correct ? "Correct" : "Wrong"}
                        </td>
                        <td className="py-3 text-right font-mono text-ftw-muted">{formatRaceTime(attempt.elapsedMs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="flex flex-col gap-4">
              <section className="ftw-card p-5">
                <h2 className="font-serif text-2xl font-black">Local Leaderboard</h2>
                <div className="mt-4 space-y-2">
                  {configResults.length === 0 && <p className="text-sm text-ftw-muted">Saving result...</p>}
                  {configResults.map((stored, index) => (
                    <div
                      key={stored.id}
                      className={`grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-xl px-3 py-2 text-sm ${
                        stored.id === result.id ? "border border-ftw-success bg-ftw-success text-ftw-panel" : "border border-ftw-line bg-ftw-raised"
                      }`}
                    >
                      <span className="font-black">#{index + 1}</span>
                      <span>{stored.correct} correct, {stored.wrong} wrong</span>
                      <span className="font-mono">{formatRaceTime(stored.durationMs)}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="ftw-card p-5">
                <h2 className="font-serif text-xl font-black">Personal Best</h2>
                <p className="mt-2 text-sm text-ftw-muted">
                  {personalBest
                    ? `${personalBest.correct} correct, ${personalBest.wrong} wrong, ${formatRaceTime(personalBest.durationMs)}`
                    : "This run is your first saved result for the config."}
                </p>
              </section>

              <div className="ftw-card flex flex-col gap-3 p-5 sm:flex-row lg:flex-col">
                <button onClick={startSolo} className="flex-1 rounded-xl bg-ftw-success px-6 py-3 font-black text-ftw-panel transition hover:bg-ftw-success/90">
                  Race Again
                </button>
                <Link href="/race" className="flex-1 rounded-xl border border-ftw-success bg-ftw-success/10 px-6 py-3 text-center font-black text-ftw-success transition hover:bg-ftw-success hover:text-ftw-panel">
                  Configure
                </Link>
                <Link href="/" className="ftw-button-secondary flex-1 text-center">
                  Home
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="ftw-page-shell min-h-screen p-4 text-ftw-text md:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="ftw-card flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="ftw-label text-ftw-success">Solo Race</p>
            <h1 className="mt-2 font-serif text-3xl font-black md:text-5xl">{configLabel}</h1>
            <p className="mt-2 text-sm text-ftw-muted">Seed {config.seed}. Problems are generated locally and deterministically.</p>
          </div>
          <div className="flex items-center gap-4">
            {config.mode === "sprint" ? (
              <TimerRing durationMs={sprintDurationMs} remainingMs={status === "active" ? remainingMs : sprintDurationMs} size={92} />
            ) : (
              <div className="rounded-full border border-ftw-accent bg-ftw-accent/10 px-5 py-4 text-center">
                <div className="ftw-label text-ftw-muted">Elapsed</div>
                <div className="ftw-number text-2xl">{formatRaceTime(elapsedMs)}</div>
              </div>
            )}
          </div>
        </header>

        {status === "ready" ? (
          <section className="ftw-card p-8 text-center">
            <p className="ftw-label text-ftw-muted">Ready console</p>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="ftw-card-sm p-5">
                <div className="ftw-number text-4xl text-ftw-success">{config.minFactor}-{config.maxFactor}</div>
                <div className="mt-1 text-sm text-ftw-muted">Factor range</div>
              </div>
              <div className="ftw-card-sm p-5">
                <div className="ftw-number text-4xl text-ftw-accent">{config.mode === "sprint" ? `${config.durationSec}s` : config.targetCorrect}</div>
                <div className="mt-1 text-sm text-ftw-muted">{config.mode === "sprint" ? "Fixed window" : "Correct target"}</div>
              </div>
              <div className="ftw-card-sm p-5">
                <div className="ftw-number text-4xl text-ftw-text">{currentProblem.a} x {currentProblem.b}</div>
                <div className="mt-1 text-sm text-ftw-muted">First seeded prompt</div>
              </div>
            </div>
            <button onClick={startSolo} className="mt-8 rounded-ftw-sm bg-ftw-success px-10 py-5 text-xl font-black text-ftw-panel shadow-ftw-sm transition hover:bg-ftw-success/90">
              Start Race
            </button>
          </section>
        ) : (
          <section className="grid gap-6 lg:grid-cols-[1fr_18rem]">
            <div className={`rounded-ftw border p-8 shadow-ftw ${feedback === "wrong" ? "border-ftw-danger bg-ftw-danger/15" : feedback === "correct" ? "border-ftw-success bg-ftw-success/15" : "border-ftw-line bg-ftw-panel"}`}>
              <div className="text-center">
                <p className="ftw-label text-ftw-muted">Problem {problemIndex + 1}</p>
                <div className="ftw-number mt-6 text-7xl tracking-tight text-ftw-text sm:text-8xl">
                  {currentProblem.a} <span className="text-ftw-accent">x</span> {currentProblem.b}
                </div>
              </div>
              <form onSubmit={submitAnswer} className="mx-auto mt-8 flex max-w-md flex-col gap-4">
                <input
                  ref={inputRef}
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value.replace(/[^0-9]/g, ""))}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  className="ftw-input ftw-number rounded-ftw px-6 py-5 text-center text-5xl focus:border-ftw-success"
                  placeholder="?"
                />
                <button className="ftw-button-primary py-4 text-lg">
                  Submit
                </button>
              </form>
              <div className="mt-6 text-center text-sm text-ftw-muted">
                Next seeded prompt: {nextProblem.a} x {nextProblem.b}
              </div>
            </div>

            <aside className="flex flex-col gap-4">
              <div className="ftw-card-sm p-5 text-center">
                <div className="ftw-number text-5xl text-ftw-success">{correct}</div>
                <div className="mt-1 text-sm text-ftw-muted">Correct</div>
              </div>
              <div className="ftw-card-sm p-5 text-center">
                <div className="ftw-number text-5xl text-ftw-danger">{wrong}</div>
                <div className="mt-1 text-sm text-ftw-muted">Wrong</div>
              </div>
              <div className="ftw-card-sm p-5 text-center">
                <div className="ftw-number text-4xl text-ftw-accent">{pace.toFixed(1)}</div>
                <div className="mt-1 text-sm text-ftw-muted">Correct per min</div>
              </div>
              <button onClick={() => finishRace()} className="ftw-button-secondary hover:border-ftw-danger hover:text-ftw-danger">
                End Run
              </button>
            </aside>
          </section>
        )}
      </div>
    </main>
  );
}
