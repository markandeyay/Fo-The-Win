"use client";

import { motion } from "framer-motion";

interface ScoreboardProps {
  score: number;
  roundIndex: number;
  roundCount: number;
}

export function Scoreboard({ score, roundIndex, roundCount }: ScoreboardProps) {
  return (
    <div className="flex items-center gap-6 rounded-2xl border border-gray-700 bg-ftw-panel px-6 py-3 shadow">
      <div>
        <div className="text-xs uppercase tracking-wider text-ftw-muted">Score</div>
        <motion.div
          key={score}
          initial={{ scale: 1.2, color: "#f59e0b" }}
          animate={{ scale: 1, color: "#f3f4f6" }}
          className="text-2xl font-bold"
        >
          {score}
        </motion.div>
      </div>
      <div className="h-8 w-px bg-gray-700" />
      <div>
        <div className="text-xs uppercase tracking-wider text-ftw-muted">Round</div>
        <div className="text-2xl font-bold">
          {roundIndex + 1} <span className="text-ftw-muted text-base">/ {roundCount}</span>
        </div>
      </div>
    </div>
  );
}
