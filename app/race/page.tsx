"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TimerRing } from "@/components/TimerRing";
import {
  RACE_RESULTS_STORAGE_KEY,
  compareRaceResults,
  formatRaceTime,
  makeRaceRoomCode,
  makeRaceSeed,
  normalizeRaceConfig,
  type RaceMode,
  type RacePlayerMode,
  type RaceResult,
} from "@/lib/race";

const presets = [
  { label: "Classic 2-12", min: 2, max: 12 },
  { label: "Single digit", min: 2, max: 9 },
  { label: "Teens", min: 10, max: 19 },
  { label: "2-digit by 2-digit", min: 10, max: 99 },
];

function readRaceResults(): RaceResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RACE_RESULTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function RaceConfigPage() {
  const router = useRouter();
  const [minFactor, setMinFactor] = useState(2);
  const [maxFactor, setMaxFactor] = useState(12);
  const [mode, setMode] = useState<RaceMode>("sprint");
  const [playerMode, setPlayerMode] = useState<RacePlayerMode>("solo");
  const [durationSec, setDurationSec] = useState(60);
  const [targetCorrect, setTargetCorrect] = useState(20);
  const [seed, setSeed] = useState(makeRaceSeed);
  const [roomCode, setRoomCode] = useState(makeRaceRoomCode);
  const [results, setResults] = useState<RaceResult[]>([]);

  useEffect(() => {
    setResults(readRaceResults());
  }, []);

  const normalized = normalizeRaceConfig({
    minFactor,
    maxFactor,
    mode,
    playerMode,
    durationSec,
    targetCorrect,
    seed,
    roomCode,
  });

  const localLeaders = useMemo(
    () =>
      results
        .filter(
          (result) =>
            result.mode === normalized.mode &&
            result.minFactor === normalized.minFactor &&
            result.maxFactor === normalized.maxFactor &&
            (normalized.mode === "sprint" || result.targetCorrect === normalized.targetCorrect)
        )
        .sort(compareRaceResults)
        .slice(0, 5),
    [normalized.maxFactor, normalized.minFactor, normalized.mode, normalized.targetCorrect, results]
  );

  function startRace() {
    const config = normalizeRaceConfig({
      minFactor,
      maxFactor,
      mode,
      playerMode,
      durationSec,
      targetCorrect,
      seed,
      roomCode,
    });
    const params = new URLSearchParams({
      min: config.minFactor.toString(),
      max: config.maxFactor.toString(),
      mode: config.mode,
      players: config.playerMode,
      duration: config.durationSec.toString(),
      target: config.targetCorrect.toString(),
      seed: config.seed,
    });
    if (config.playerMode === "mp" && config.roomCode) {
      params.set("room", config.roomCode);
    }
    router.push(`/race/play?${params.toString()}`);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#22c55e44,transparent_24rem),radial-gradient(circle_at_bottom_right,#f59e0b33,transparent_28rem),#0b0f19] p-4 text-ftw-text md:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-[2rem] border border-ftw-success/50 bg-gray-950/80 p-6 shadow-2xl shadow-green-950/30 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.42em] text-ftw-success">Speed Multiplication Race</p>
            <h1 className="mt-3 text-5xl font-black tracking-tight text-white md:text-7xl">Times Table Blitz</h1>
            <p className="mt-3 max-w-2xl text-ftw-muted">
              Procedural multiplication, seeded runs, solo records, and an MP-ready seed path outside the algebra topic tree.
            </p>
          </div>
          <Link href="/" className="text-ftw-muted underline underline-offset-4 transition hover:text-ftw-text">
            Back to Home
          </Link>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.75fr]">
          <section className="rounded-[2rem] border border-gray-700 bg-ftw-panel/90 p-6 shadow-xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-black">Race Setup</h2>
                <p className="text-sm text-ftw-muted">Defaults are 2 to 12. Ranges can go up to 99 by 99.</p>
              </div>
              <div className="rounded-full border border-ftw-success/50 bg-ftw-success/10 px-4 py-2 text-sm font-bold text-ftw-success">
                race.multiplication procedural
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => {
                    setMinFactor(preset.min);
                    setMaxFactor(preset.max);
                  }}
                  className={`rounded-2xl border p-4 text-left transition ${
                    minFactor === preset.min && maxFactor === preset.max
                      ? "border-ftw-success bg-ftw-success text-ftw-dark"
                      : "border-gray-700 bg-gray-950/60 hover:border-ftw-success"
                  }`}
                >
                  <span className="block text-lg font-black">{preset.label}</span>
                  <span className="text-sm opacity-80">{preset.min} x {preset.min} through {preset.max} x {preset.max}</span>
                </button>
              ))}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-bold text-ftw-muted">Minimum factor</span>
                <input
                  type="number"
                  min={2}
                  max={99}
                  value={minFactor}
                  onChange={(event) => setMinFactor(Number(event.target.value))}
                  className="w-full rounded-2xl border border-gray-700 bg-gray-950 px-4 py-4 text-2xl font-black outline-none focus:border-ftw-success"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-bold text-ftw-muted">Maximum factor</span>
                <input
                  type="number"
                  min={2}
                  max={99}
                  value={maxFactor}
                  onChange={(event) => setMaxFactor(Number(event.target.value))}
                  className="w-full rounded-2xl border border-gray-700 bg-gray-950 px-4 py-4 text-2xl font-black outline-none focus:border-ftw-success"
                />
              </label>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <section className="rounded-3xl border border-gray-700 bg-gray-950/45 p-4">
                <h3 className="text-lg font-black">Mode</h3>
                <div className="mt-3 grid gap-2">
                  {(["sprint", "first_to_n"] as const).map((nextMode) => (
                    <button
                      key={nextMode}
                      onClick={() => setMode(nextMode)}
                      className={`rounded-xl border px-4 py-3 text-left transition ${
                        mode === nextMode
                          ? "border-ftw-accent bg-ftw-accent text-ftw-dark"
                          : "border-gray-700 bg-ftw-panel hover:border-ftw-accent"
                      }`}
                    >
                      <span className="block font-black">{nextMode === "sprint" ? "Sprint" : "First to N"}</span>
                      <span className="text-sm opacity-80">
                        {nextMode === "sprint" ? "Most correct in a fixed window" : "Reach the target with lowest time"}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-gray-700 bg-gray-950/45 p-4">
                <h3 className="text-lg font-black">Players</h3>
                <div className="mt-3 grid gap-2">
                  {(["solo", "mp"] as const).map((nextPlayerMode) => (
                    <button
                      key={nextPlayerMode}
                      onClick={() => setPlayerMode(nextPlayerMode)}
                      className={`rounded-xl border px-4 py-3 text-left transition ${
                        playerMode === nextPlayerMode
                          ? "border-ftw-info bg-ftw-info text-white"
                          : "border-gray-700 bg-ftw-panel hover:border-ftw-info"
                      }`}
                    >
                      <span className="block font-black">{nextPlayerMode === "solo" ? "Solo local" : "MP seed stub"}</span>
                      <span className="text-sm opacity-80">
                        {nextPlayerMode === "solo" ? "Scores save to this browser" : "Shared seed, no client-side MP scoring"}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-bold text-ftw-muted">Sprint window, seconds</span>
                <input
                  type="number"
                  min={10}
                  max={300}
                  value={durationSec}
                  onChange={(event) => setDurationSec(Number(event.target.value))}
                  disabled={mode !== "sprint"}
                  className="w-full rounded-2xl border border-gray-700 bg-gray-950 px-4 py-4 text-2xl font-black outline-none focus:border-ftw-accent disabled:opacity-45"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-bold text-ftw-muted">First-to-N target</span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={targetCorrect}
                  onChange={(event) => setTargetCorrect(Number(event.target.value))}
                  disabled={mode !== "first_to_n"}
                  className="w-full rounded-2xl border border-gray-700 bg-gray-950 px-4 py-4 text-2xl font-black outline-none focus:border-ftw-accent disabled:opacity-45"
                />
              </label>
            </div>
          </section>

          <aside className="flex flex-col gap-5">
            <section className="rounded-[2rem] border border-ftw-success/40 bg-ftw-success/10 p-5 shadow-xl">
              <div className="flex items-center gap-4">
                <TimerRing durationMs={normalized.durationSec * 1000} remainingMs={normalized.durationSec * 1000} size={78} />
                <div>
                  <h2 className="text-xl font-black">Defaults Locked</h2>
                  <p className="text-sm text-ftw-muted">
                    Sprint starts at 60s. First-to-N starts at 20 correct.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-gray-700 bg-ftw-panel/90 p-5 shadow-xl">
              <h2 className="text-xl font-black">Seed</h2>
              <p className="mt-1 text-sm text-ftw-muted">Same seed plus same range gives every player the same sequence.</p>
              <input
                value={seed}
                onChange={(event) => setSeed(event.target.value.toUpperCase())}
                className="mt-4 w-full rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 font-mono text-xl font-black tracking-[0.18em] outline-none focus:border-ftw-success"
              />
              <button
                onClick={() => setSeed(makeRaceSeed())}
                className="mt-3 w-full rounded-xl border border-gray-600 px-4 py-3 font-bold transition hover:border-ftw-success hover:text-ftw-success"
              >
                Reroll Seed
              </button>
            </section>

            {playerMode === "mp" && (
              <section className="rounded-[2rem] border border-ftw-info/50 bg-ftw-info/10 p-5 shadow-xl">
                <h2 className="text-xl font-black">MP Scaffold</h2>
                <p className="mt-1 text-sm text-ftw-muted">
                  This creates a deterministic room link only. Competitive MP scoring must come from the server authority path.
                </p>
                <label className="mt-4 block space-y-2">
                  <span className="text-sm font-bold text-ftw-muted">Room code</span>
                  <input
                    value={roomCode}
                    onChange={(event) => setRoomCode(event.target.value.toUpperCase().slice(0, 6))}
                    className="w-full rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 font-mono text-2xl font-black tracking-[0.25em] outline-none focus:border-ftw-info"
                  />
                </label>
                <button
                  onClick={() => setRoomCode(makeRaceRoomCode())}
                  className="mt-3 w-full rounded-xl border border-ftw-info px-4 py-3 font-bold text-ftw-info transition hover:bg-ftw-info hover:text-white"
                >
                  New Room Code
                </button>
              </section>
            )}

            <button
              onClick={startRace}
              className="rounded-2xl bg-ftw-success px-6 py-5 text-lg font-black text-ftw-dark shadow-xl shadow-green-950/30 transition hover:bg-green-300"
            >
              {playerMode === "mp" ? "Open MP Seed Room" : "Start Solo Race"}
            </button>

            <section className="rounded-[2rem] border border-gray-700 bg-ftw-panel/90 p-5 shadow-xl">
              <h2 className="text-xl font-black">Local Leaders</h2>
              <p className="mt-1 text-sm text-ftw-muted">
                Current config: {normalized.minFactor}-{normalized.maxFactor}, {normalized.mode === "sprint" ? `${normalized.durationSec}s sprint` : `first to ${normalized.targetCorrect}`}.
              </p>
              <div className="mt-4 space-y-2">
                {localLeaders.length === 0 && <p className="text-sm text-ftw-muted">No local results yet.</p>}
                {localLeaders.map((result, index) => (
                  <div key={result.id} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-xl bg-gray-950/50 px-3 py-2 text-sm">
                    <span className="font-black text-ftw-accent">#{index + 1}</span>
                    <span>{result.correct} correct, {result.wrong} wrong</span>
                    <span className="font-mono text-ftw-muted">{formatRaceTime(result.durationMs)}</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
