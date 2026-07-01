"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import taxonomy from "@/content/taxonomy.json";
import { TimerRing } from "@/components/TimerRing";
import { TopicTree } from "@/components/TopicTree";
import { BASE_TIME_SECONDS } from "@/lib/timing";

type Difficulty = "easy" | "medium" | "hard";
type RoundCount = 5 | 10 | 20 | "endless";
type BotId = "rookie" | "regular" | "sharp";
type AnswerMode = "mc" | "free";

const botProfiles: Record<BotId, { name: string; description: string; accuracy: string }> = {
  rookie: { name: "Rookie", description: "Slow pace, forgiving accuracy", accuracy: "55%" },
  regular: { name: "Regular", description: "Balanced pace and accuracy", accuracy: "75%" },
  sharp: { name: "Sharp", description: "Fast and hard to beat", accuracy: "90%" },
};

export default function SoloConfigPage() {
  const router = useRouter();
  const [selectedTopics, setSelectedTopics] = useState<string[]>(["ch1.numbers"]);
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [roundCount, setRoundCount] = useState<RoundCount>(10);
  const [selectedBots, setSelectedBots] = useState<BotId[]>([]);
  const [answerMode, setAnswerMode] = useState<AnswerMode>("mc");

  const baseSeconds = BASE_TIME_SECONDS[difficulty];
  const minSeconds = Math.max(8, Math.round(baseSeconds * 0.6));
  const maxSeconds = Math.max(8, Math.round(baseSeconds * 1.6));

  function toggleBot(botId: BotId) {
    setSelectedBots((current) =>
      current.includes(botId)
        ? current.filter((id) => id !== botId)
        : [...current, botId]
    );
  }

  function start() {
    if (selectedTopics.length === 0 || roundCount === "endless") return;
    const params = new URLSearchParams({
      topic_ids: selectedTopics.join(","),
      difficulty,
      rounds: roundCount.toString(),
      answer_mode: answerMode,
    });
    if (selectedBots.length > 0) {
      params.set("bots", selectedBots.join(","));
    }
    router.push(`/solo/play?${params.toString()}`);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1f2937_0%,#0b0f19_48%)] p-4 text-ftw-text md:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-3 rounded-3xl border border-amber-500/30 bg-ftw-panel/80 p-6 shadow-2xl shadow-black/30 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-ftw-accent">Solo config</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight md:text-5xl">
              Build a local FTW run
            </h1>
            <p className="mt-2 max-w-2xl text-ftw-muted">
              Mix topics, choose entry style, and add optional bots for pacing. Chapters 1 to 6 use the local bank in this milestone.
            </p>
          </div>
          <Link href="/" className="text-ftw-muted underline underline-offset-4 hover:text-ftw-text">
            Back to Home
          </Link>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-3xl border border-gray-700 bg-ftw-panel/90 p-5 shadow-xl">
            <TopicTree
              groups={taxonomy.groups}
              selectedTopicIds={selectedTopics}
              onSelectedTopicIdsChange={setSelectedTopics}
              description={`${selectedTopics.length} topic${selectedTopics.length === 1 ? "" : "s"} selected`}
            />
          </section>

          <aside className="flex flex-col gap-5">
            <section className="rounded-3xl border border-gray-700 bg-ftw-panel/90 p-5 shadow-xl">
              <h2 className="text-xl font-bold">Difficulty</h2>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(["easy", "medium", "hard"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`rounded-xl border px-4 py-3 capitalize transition ${
                      difficulty === d
                        ? "border-ftw-accent bg-ftw-accent text-ftw-dark font-bold"
                        : "border-gray-600 bg-gray-900 hover:border-ftw-accent"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-gray-700 bg-ftw-panel/90 p-5 shadow-xl">
              <h2 className="text-xl font-bold">Rounds</h2>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {([5, 10, 20, "endless"] as const).map((n) => (
                  <button
                    key={n}
                    onClick={() => setRoundCount(n)}
                    className={`rounded-xl border px-3 py-3 capitalize transition ${
                      roundCount === n
                        ? "border-ftw-accent bg-ftw-accent text-ftw-dark font-bold"
                        : "border-gray-600 bg-gray-900 hover:border-ftw-accent"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {roundCount === "endless" && (
                <p className="mt-3 text-sm text-ftw-muted">
                  Endless is visible as the v1 stub. Pick 5, 10, or 20 to start a playable run.
                </p>
              )}
            </section>

            <section className="rounded-3xl border border-gray-700 bg-ftw-panel/90 p-5 shadow-xl">
              <h2 className="text-xl font-bold">Answer Input</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(["mc", "free"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setAnswerMode(mode)}
                    className={`rounded-xl border px-4 py-3 transition ${
                      answerMode === mode
                        ? "border-ftw-accent bg-ftw-accent text-ftw-dark font-bold"
                        : "border-gray-600 bg-gray-900 hover:border-ftw-accent"
                    }`}
                  >
                    {mode === "mc" ? "Multiple choice" : "Free entry"}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-sm text-ftw-muted">
                Free entry uses the local answer normalizer for numeric, exact, and equivalent expression checks.
              </p>
            </section>

            <section className="rounded-3xl border border-gray-700 bg-ftw-panel/90 p-5 shadow-xl">
              <h2 className="text-xl font-bold">Bots</h2>
              <div className="mt-3 space-y-2">
                {(Object.keys(botProfiles) as BotId[]).map((botId) => {
                  const bot = botProfiles[botId];
                  const checked = selectedBots.includes(botId);
                  return (
                    <button
                      key={botId}
                      onClick={() => toggleBot(botId)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        checked
                          ? "border-ftw-accent bg-amber-500/10"
                          : "border-gray-600 bg-gray-900 hover:border-ftw-accent"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="font-bold">{bot.name}</span>
                        <span className="text-sm text-ftw-accent">{bot.accuracy}</span>
                      </span>
                      <span className="mt-1 block text-sm text-ftw-muted">{bot.description}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 shadow-xl">
              <div className="flex items-center gap-4">
                <TimerRing durationMs={baseSeconds * 1000} remainingMs={baseSeconds * 1000} size={74} />
                <div>
                  <h2 className="text-xl font-bold">Timer Preview</h2>
                  <p className="text-sm text-ftw-muted">
                    {difficulty} base is {baseSeconds}s. Problem complexity can make rounds {minSeconds}s to {maxSeconds}s.
                  </p>
                </div>
              </div>
            </section>

            <button
              onClick={start}
              disabled={selectedTopics.length === 0 || roundCount === "endless"}
              className="rounded-2xl bg-ftw-accent px-6 py-4 text-lg font-black text-ftw-dark shadow-xl shadow-amber-950/30 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Start Session
            </button>
          </aside>
        </div>
      </div>
    </main>
  );
}
