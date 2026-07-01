"use client";

import { useEffect, useCallback } from "react";
import { MixedKatex } from "./MixedKatex";
import type { Problem } from "@/lib/sessionMachine";

interface ProblemCanvasProps {
  problem: Problem;
  onAnswer: (choiceId: string) => void;
  disabled?: boolean;
}

export function ProblemCanvas({ problem, onAnswer, disabled }: ProblemCanvasProps) {
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (disabled) return;
      const index = parseInt(e.key, 10);
      if (isNaN(index) || index < 1 || index > (problem.choices?.length ?? 0)) return;
      const choice = problem.choices![index - 1];
      onAnswer(choice.id);
    },
    [disabled, onAnswer, problem.choices]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl">
      <div className="text-xl md:text-2xl leading-relaxed bg-ftw-panel border border-gray-700 rounded-2xl p-6 shadow-lg">
        <MixedKatex source={problem.prompt_latex} />
      </div>

      {problem.answer_format === "mc" && problem.choices && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {problem.choices.map((choice, index) => (
            <button
              key={choice.id}
              disabled={disabled}
              onClick={() => onAnswer(choice.id)}
              className="flex items-center gap-3 rounded-xl border border-gray-600 bg-ftw-panel px-4 py-4 text-left hover:border-ftw-accent hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 font-bold text-ftw-accent">
                {index + 1}
              </span>
              <span className="text-lg">
                <MixedKatex source={choice.latex} />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
