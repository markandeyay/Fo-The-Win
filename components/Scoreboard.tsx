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
  "border-ftw-accent bg-ftw-accent/15 text-ftw-accent",
  "border-ftw-success bg-ftw-success/15 text-ftw-success",
  "border-ftw-warning bg-ftw-warning/15 text-ftw-warning",
  "border-ftw-line bg-ftw-canvas text-ftw-muted",
];

export function Scoreboard({ score, roundIndex, roundCount, players, label = "Scoreboard" }: ScoreboardProps) {
  const prefersReducedMotion = useReducedMotion();
  const sortedPlayers = players ? [...players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)) : [];

  return (
    <section
      aria-label={label}
      className="ftw-card w-full overflow-hidden"
    >
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="ftw-card-sm px-4 py-3">
            <div className="ftw-label text-ftw-muted">Score</div>
            <motion.div
              key={score}
              initial={prefersReducedMotion ? false : { scale: 1.16, color: "var(--ftw-accent)" }}
              animate={{ scale: 1, color: "var(--ftw-text)" }}
              className="ftw-number text-3xl leading-none"
            >
              {score}
            </motion.div>
          </div>
          <div className="ftw-card-sm px-4 py-3">
            <div className="ftw-label text-ftw-muted">Round</div>
            <div className="ftw-number text-3xl leading-none text-ftw-text">
              {roundIndex + 1} <span className="text-base text-ftw-muted">/ {roundCount}</span>
            </div>
          </div>
        </div>

        <div className="min-w-0 text-sm text-ftw-muted">
          <span className="ftw-label text-ftw-accent">FTW live</span>
        </div>
      </div>

      {sortedPlayers.length > 0 && (
        <div className="border-t border-ftw-line p-3">
          <div className="grid gap-2" role="list" aria-label="Player standings">
            {sortedPlayers.map((player, index) => {
              const style = rankStyles[Math.min(index, rankStyles.length - 1)];
              return (
                <motion.div
                  key={player.id}
                  layout={!prefersReducedMotion}
                  role="listitem"
                  className={`grid grid-cols-[2.75rem_1fr_auto] items-center gap-3 rounded-ftw-sm border px-3 py-2 shadow-ftw-sm ${style} ${
                    player.isLocal ? "ring-2 ring-ftw-accent/70" : ""
                  }`}
                >
                  <span className="ftw-number text-lg">#{index + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-black text-ftw-text">
                      {player.name}{player.isLocal ? " (you)" : ""}
                    </span>
                    <span className="text-xs text-ftw-muted">
                      {player.status ?? `${player.correctCount ?? 0} correct`}
                    </span>
                  </span>
                  <span className="ftw-number text-right text-xl text-ftw-text">
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
