import { roundDurationMs } from "./timing";

export interface Problem {
  id: string;
  prompt_latex: string;
  answer_format: "mc" | "numeric" | "exact";
  choices?: { id: string; latex: string }[];
  correct_choice?: string;
  correct_answer: string;
  answer_type: string;
  solution_latex: string;
  complexity_factor: number;
}

export interface RoundResult {
  problemId: string;
  correct: boolean;
  points: number;
  timeMs: number;
}

export interface SessionConfig {
  mode: "solo" | "mp" | "race";
  roundCount: number;
  difficulty: string;
}

export interface SessionState {
  status:
    | "idle"
    | "countdown"
    | "question_active"
    | "question_reveal"
    | "results";
  config: SessionConfig;
  problems: Problem[];
  roundIndex: number;
  results: RoundResult[];
  roundStartMs: number;
  roundDurationMs: number;
  revealCorrect?: boolean;
}

export type SessionAction =
  | { type: "START_SESSION"; config: SessionConfig; problems: Problem[] }
  | { type: "START_COUNTDOWN" }
  | { type: "START_QUESTION" }
  | { type: "SUBMIT_ANSWER"; correct: boolean; timeMs: number; points: number }
  | { type: "REVEAL_ROUND" }
  | { type: "NEXT_ROUND" }
  | { type: "END_SESSION" }
  | { type: "RESET" };

export function sessionMachineReducer(
  state: SessionState,
  action: SessionAction
): SessionState {
  switch (action.type) {
    case "START_SESSION": {
      return {
        status: "countdown",
        config: action.config,
        problems: action.problems,
        roundIndex: 0,
        results: [],
        roundStartMs: 0,
        roundDurationMs: 0,
      };
    }
    case "START_COUNTDOWN":
      return { ...state, status: "countdown" };
    case "START_QUESTION": {
      const problem = state.problems[state.roundIndex];
      const duration = roundDurationMs(state.config.difficulty, problem.complexity_factor);
      return {
        ...state,
        status: "question_active",
        roundStartMs: Date.now(),
        roundDurationMs: duration,
      };
    }
    case "SUBMIT_ANSWER": {
      if (state.status !== "question_active") return state;
      const result: RoundResult = {
        problemId: state.problems[state.roundIndex].id,
        correct: action.correct,
        points: action.points,
        timeMs: action.timeMs,
      };
      return {
        ...state,
        status: "question_reveal",
        results: [...state.results, result],
        revealCorrect: action.correct,
      };
    }
    case "REVEAL_ROUND": {
      if (state.status !== "question_active") return state;
      const duration = state.roundDurationMs;
      const elapsed = Date.now() - state.roundStartMs;
      const result: RoundResult = {
        problemId: state.problems[state.roundIndex].id,
        correct: false,
        points: 0,
        timeMs: Math.min(elapsed, duration),
      };
      return {
        ...state,
        status: "question_reveal",
        results: [...state.results, result],
        revealCorrect: false,
      };
    }
    case "NEXT_ROUND": {
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= state.problems.length) {
        return { ...state, status: "results" };
      }
      return {
        ...state,
        status: "question_active",
        roundIndex: nextIndex,
        roundStartMs: Date.now(),
        roundDurationMs: roundDurationMs(
          state.config.difficulty,
          state.problems[nextIndex].complexity_factor
        ),
      };
    }
    case "END_SESSION":
      return { ...state, status: "results" };
    case "RESET":
      return {
        status: "idle",
        config: { mode: "solo", roundCount: 5, difficulty: "easy" },
        problems: [],
        roundIndex: 0,
        results: [],
        roundStartMs: 0,
        roundDurationMs: 0,
      };
    default:
      return state;
  }
}

export const initialSessionState: SessionState = {
  status: "idle",
  config: { mode: "solo", roundCount: 5, difficulty: "easy" },
  problems: [],
  roundIndex: 0,
  results: [],
  roundStartMs: 0,
  roundDurationMs: 0,
};
