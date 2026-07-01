"use client";

import { motion, useReducedMotion } from "framer-motion";

export interface ScoreboardPlayer {
  id: string;
  name: string;
  score: number;
  delta?: number;
  correctCount?: number;
  status?: string;
  isLocal?: boolean;
}

interface ScoreboardProps {
  score: number;
  roundIndex: number;
  roundCount: number;
  players?: ScoreboardPlayer[];
  label?: string;
}

const rankStyles = [
  "border-cyan-300 bg-cyan-300/10 text-cyan-100",
  "border-yellow-300 bg-yellow-300/10 text-yellow-100",
  "border-fuchsia-300 bg-fuchsia-300/10 text-fuchsia-100",
  "border-slate-500 bg-slate-500/10 text-slate-100",
];

export function Scoreboard({ score, roundIndex, roundCount, players, label = "Scoreboard" }: ScoreboardProps) {
  const prefersReducedMotion = useReducedMotion();
  const sortedPlayers = players ? [...players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)) : [];

  return (
    <section
      aria-label={label}
      className="w-full overflow-hidden rounded-3xl border border-slate-700 bg-ftw-panel/95 shadow-2xl shadow-black/30"
    >
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl border border-ftw-accent/60 bg-amber-400/10 px-4 py-3">
            <div className="text-xs font-black uppercase tracking-[0.25em] text-ftw-muted">Score</div>
            <motion.div
              key={score}
              initial={prefersReducedMotion ? false : { scale: 1.16, color: "#facc15" }}
              animate={{ scale: 1, color: "#f8fafc" }}
              className="font-mono text-3xl font-black leading-none"
            >
              {score}
            </motion.div>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-gray-950 px-4 py-3">
            <div className="text-xs font-black uppercase tracking-[0.25em] text-ftw-muted">Round</div>
            <div className="font-mono text-3xl font-black leading-none text-white">
              {roundIndex + 1} <span className="text-base text-ftw-muted">/ {roundCount}</span>
            </div>
          </div>
        </div>

        <div className="min-w-0 text-sm text-ftw-muted">
          <span className="font-black uppercase tracking-[0.22em] text-ftw-accent">FTW live</span>
          <span className="ml-2">Rank uses numbers, labels, and distinct hues.</span>
        </div>
      </div>

      {sortedPlayers.length > 0 && (
        <div className="border-t border-slate-800 p-3">
          <div className="grid gap-2" role="list" aria-label="Player standings">
            {sortedPlayers.map((player, index) => {
              const style = rankStyles[Math.min(index, rankStyles.length - 1)];
              return (
                <motion.div
                  key={player.id}
                  layout={!prefersReducedMotion}
                  role="listitem"
                  className={`grid grid-cols-[2.75rem_1fr_auto] items-center gap-3 rounded-2xl border px-3 py-2 ${style} ${
                    player.isLocal ? "ring-2 ring-ftw-accent/70" : ""
                  }`}
                >
                  <span className="font-mono text-lg font-black">#{index + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-black text-white">
                      {player.name}{player.isLocal ? " (you)" : ""}
                    </span>
                    <span className="text-xs text-ftw-muted">
                      {player.status ?? `${player.correctCount ?? 0} correct`}
                    </span>
                  </span>
                  <span className="text-right font-mono text-xl font-black text-white">
                    {player.score}
                    {player.delta !== undefined && player.delta !== 0 && (
                      <span className="ml-2 text-sm text-ftw-accent">+{player.delta}</span>
                    )}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
