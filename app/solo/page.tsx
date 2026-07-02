"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import taxonomy from "@/content/taxonomy.json";
import { TimerRing } from "@/components/TimerRing";
import { TopicTree } from "@/components/TopicTree";
import { BASE_TIME_SECONDS } from "@/lib/timing";

type Difficulty = "easy" | "medium" | "hard";
type RoundCount = 5 | 10 | 20;
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
    if (selectedTopics.length === 0) return;
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
    <main className="ftw-page-shell min-h-screen p-4 text-ftw-text md:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="ftw-card flex flex-col gap-3 p-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="ftw-label text-ftw-accent">Solo config</p>
            <h1 className="ftw-display mt-2 text-4xl md:text-5xl">
              Build a local FTW run
            </h1>
          </div>
          <Link href="/" className="text-ftw-muted underline underline-offset-4 hover:text-ftw-text">
            Back to Home
          </Link>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="ftw-card p-5">
            <TopicTree
              groups={taxonomy.groups}
              selectedTopicIds={selectedTopics}
              onSelectedTopicIdsChange={setSelectedTopics}
              description={`${selectedTopics.length} topic${selectedTopics.length === 1 ? "" : "s"} selected`}
            />
          </section>

          <aside className="flex flex-col gap-5">
            <section className="ftw-card p-5">
              <h2 className="font-serif text-xl font-bold">Difficulty</h2>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(["easy", "medium", "hard"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`rounded-xl border px-4 py-3 capitalize transition ${
                      difficulty === d
                        ? "border-ftw-accent bg-ftw-accent text-ftw-panel font-bold"
                        : "border-ftw-line bg-ftw-raised hover:border-ftw-accent"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </section>

            <section className="ftw-card p-5">
              <h2 className="font-serif text-xl font-bold">Rounds</h2>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {([5, 10, 20] as const).map((n) => (
                  <button
                    key={n}
                    onClick={() => setRoundCount(n)}
                    className={`rounded-xl border px-3 py-3 capitalize transition ${
                      roundCount === n
                        ? "border-ftw-accent bg-ftw-accent text-ftw-panel font-bold"
                        : "border-ftw-line bg-ftw-raised hover:border-ftw-accent"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </section>

            <section className="ftw-card p-5">
              <h2 className="font-serif text-xl font-bold">Answer Input</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(["mc", "free"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setAnswerMode(mode)}
                    className={`rounded-xl border px-4 py-3 transition ${
                      answerMode === mode
                        ? "border-ftw-accent bg-ftw-accent text-ftw-panel font-bold"
                        : "border-ftw-line bg-ftw-raised hover:border-ftw-accent"
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

            <section className="ftw-card p-5">
              <h2 className="font-serif text-xl font-bold">Bots</h2>
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
                          ? "border-ftw-accent bg-ftw-accent/15"
                          : "border-ftw-line bg-ftw-raised hover:border-ftw-accent"
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

            <section className="rounded-ftw border border-ftw-accent/40 bg-ftw-accent/10 p-5 shadow-ftw-sm">
              <div className="flex items-center gap-4">
                <TimerRing durationMs={baseSeconds * 1000} remainingMs={baseSeconds * 1000} size={74} />
                <div>
                  <h2 className="font-serif text-xl font-bold">Timer Preview</h2>
                  <p className="text-sm text-ftw-muted">
                    {difficulty} base is {baseSeconds}s. Problem complexity can make rounds {minSeconds}s to {maxSeconds}s.
                  </p>
                </div>
              </div>
            </section>

            <button
              onClick={start}
              disabled={selectedTopics.length === 0}
              className="ftw-button-primary py-4 text-lg"
            >
              Start Session
            </button>
          </aside>
        </div>
      </div>
    </main>
  );
}
