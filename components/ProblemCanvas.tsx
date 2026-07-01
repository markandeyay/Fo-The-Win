"use client";

import { FormEvent, useEffect, useCallback, useState } from "react";
import { MixedKatex } from "./MixedKatex";
import type { Problem } from "@/lib/sessionMachine";

interface ProblemCanvasProps {
  problem: Problem;
  onAnswer: (answer: string) => void;
  answerMode?: "mc" | "free";
  disabled?: boolean;
}

export function ProblemCanvas({
  problem,
  onAnswer,
  answerMode = "mc",
  disabled,
}: ProblemCanvasProps) {
  const [freeAnswer, setFreeAnswer] = useState("");
  const [submittedAnswer, setSubmittedAnswer] = useState<string | null>(null);
  const useFreeEntry = answerMode === "free" || problem.answer_format !== "mc";
  const locked = Boolean(disabled || submittedAnswer);

  const submitAnswer = useCallback(
    (answer: string) => {
      if (locked) return;
      setSubmittedAnswer(answer);
      onAnswer(answer);
    },
    [locked, onAnswer]
  );

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (locked || useFreeEntry || e.altKey || e.ctrlKey || e.metaKey) return;
      const index = parseInt(e.key, 10);
      if (isNaN(index) || index < 1 || index > (problem.choices?.length ?? 0)) return;
      e.preventDefault();
      const choice = problem.choices![index - 1];
      submitAnswer(choice.id);
    },
    [locked, problem.choices, submitAnswer, useFreeEntry]
  );

  function submitFreeAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = freeAnswer.trim();
    if (!trimmed || locked) return;
    submitAnswer(trimmed);
  }

  useEffect(() => {
    setFreeAnswer("");
    setSubmittedAnswer(null);
  }, [problem.id]);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  return (
    <section className="flex w-full max-w-3xl flex-col gap-6" aria-labelledby="problem-prompt">
      <div className="relative overflow-hidden rounded-3xl border border-slate-700 bg-ftw-panel p-5 shadow-2xl shadow-black/30 md:p-6">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-ftw-accent to-fuchsia-300" />
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-ftw-muted">
          <span className="rounded-full border border-slate-600 px-2 py-1">{problem.topic_id ?? "local"}</span>
          <span className="rounded-full border border-slate-600 px-2 py-1">{problem.answer_format}</span>
        </div>
        <div id="problem-prompt" className="text-xl leading-relaxed text-white md:text-2xl">
          <MixedKatex source={problem.prompt_latex} />
        </div>
      </div>

      {!useFreeEntry && problem.answer_format === "mc" && problem.choices && (
        <fieldset className="grid grid-cols-1 gap-4 md:grid-cols-2" disabled={locked}>
          <legend className="sr-only">Choose an answer. Number keys 1 through 4 select matching choices.</legend>
          {problem.choices.map((choice, index) => (
            <button
              key={choice.id}
              type="button"
              disabled={locked}
              aria-keyshortcuts={`${index + 1}`}
              aria-pressed={submittedAnswer === choice.id}
              onClick={() => submitAnswer(choice.id)}
              className={`group flex min-h-20 items-center gap-3 rounded-2xl border px-4 py-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ftw-accent disabled:cursor-not-allowed ${
                submittedAnswer === choice.id
                  ? "border-ftw-accent bg-amber-400/15"
                  : "border-slate-700 bg-gray-950/70 hover:border-ftw-accent hover:bg-gray-900"
              } disabled:opacity-60`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-600 bg-ftw-panel font-mono font-black text-ftw-accent group-hover:border-ftw-accent">
                {index + 1}
              </span>
              <span className="min-w-0 text-lg text-ftw-text">
                <MixedKatex source={choice.latex} />
              </span>
            </button>
          ))}
        </fieldset>
      )}

      {useFreeEntry && (
        <form onSubmit={submitFreeAnswer} className="flex flex-col gap-3">
          <label htmlFor={`answer-${problem.id}`} className="text-sm font-black uppercase tracking-[0.2em] text-ftw-muted">
            Free entry answer
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id={`answer-${problem.id}`}
              value={freeAnswer}
              onChange={(event) => setFreeAnswer(event.target.value)}
              disabled={locked}
              autoFocus
              inputMode={problem.answer_format === "numeric" ? "decimal" : "text"}
              placeholder="Type an exact answer"
              className="min-w-0 flex-1 rounded-2xl border border-slate-700 bg-gray-950 px-4 py-3 text-lg text-ftw-text outline-none transition placeholder:text-gray-500 focus:border-ftw-accent focus:ring-2 focus:ring-ftw-accent/30 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={locked || freeAnswer.trim().length === 0}
              className="rounded-2xl bg-ftw-accent px-6 py-3 font-black text-ftw-dark transition hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ftw-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submittedAnswer ? "Submitted" : "Submit"}
            </button>
          </div>
          <p className="text-sm text-ftw-muted">
            Equivalent exact forms are accepted when the normalizer can verify them.
          </p>
        </form>
      )}
    </section>
  );
}
