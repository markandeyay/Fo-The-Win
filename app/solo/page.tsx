"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import taxonomy from "@/content/taxonomy.json";

export default function SoloConfigPage() {
  const router = useRouter();
  const [topicId, setTopicId] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [roundCount, setRoundCount] = useState(5);

  const leaves = useMemo(() => {
    const out: { topic_id: string; display_name: string; group_name: string }[] = [];
    for (const group of taxonomy.groups) {
      for (const leaf of group.leaves) {
        out.push({
          topic_id: leaf.topic_id,
          display_name: leaf.display_name,
          group_name: group.display_name,
        });
      }
    }
    return out;
  }, []);

  function start() {
    if (!topicId) return;
    const params = new URLSearchParams({
      topic_id: topicId,
      difficulty,
      rounds: roundCount.toString(),
    });
    router.push(`/solo/play?${params.toString()}`);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-6">
      <h1 className="text-3xl font-bold text-ftw-accent">Solo Practice</h1>

      <div className="w-full max-w-md flex flex-col gap-4 bg-ftw-panel border border-gray-700 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col gap-2">
          <label className="text-sm text-ftw-muted">Topic</label>
          <select
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            className="rounded-lg bg-gray-800 border border-gray-600 px-4 py-3 text-ftw-text focus:border-ftw-accent outline-none"
          >
            <option value="">Choose a topic</option>
            {taxonomy.groups.map((group) => (
              <optgroup key={group.group_id} label={group.display_name}>
                {group.leaves.map((leaf) => (
                  <option key={leaf.topic_id} value={leaf.topic_id}>
                    {leaf.display_name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-ftw-muted">Difficulty</label>
          <div className="grid grid-cols-3 gap-2">
            {(["easy", "medium", "hard"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`rounded-lg border px-4 py-2 capitalize transition ${
                  difficulty === d
                    ? "border-ftw-accent bg-ftw-accent text-ftw-dark font-semibold"
                    : "border-gray-600 bg-gray-800 hover:border-ftw-accent"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-ftw-muted">Rounds</label>
          <div className="grid grid-cols-3 gap-2">
            {[5, 10, 20].map((n) => (
              <button
                key={n}
                onClick={() => setRoundCount(n)}
                className={`rounded-lg border px-4 py-2 transition ${
                  roundCount === n
                    ? "border-ftw-accent bg-ftw-accent text-ftw-dark font-semibold"
                    : "border-gray-600 bg-gray-800 hover:border-ftw-accent"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={start}
          disabled={!topicId}
          className="mt-2 rounded-xl bg-ftw-accent text-ftw-dark font-bold py-3 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-amber-400 transition"
        >
          Start Session
        </button>
      </div>

      <Link href="/" className="text-ftw-muted hover:text-ftw-text underline">
        Back to Home
      </Link>
    </main>
  );
}
