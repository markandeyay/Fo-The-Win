import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type Difficulty = "easy" | "medium" | "hard";
type AnswerType = "integer" | "fraction" | "decimal" | "expression" | "ordered_pair" | "set" | "interval" | "boolean" | "string";

interface ChoiceInput {
  value: string;
  latex?: string;
}

interface Problem {
  id: string;
  topic_id: string;
  group_id: string;
  difficulty: Difficulty;
  prompt_latex: string;
  answer_format: "mc";
  choices: { id: string; latex: string }[];
  correct_choice: string;
  correct_answer: string;
  answer_type: AnswerType;
  accepted_forms: string[];
  solution_latex: string;
  complexity_factor: number;
  source_section: string;
  tags: string[];
  checksum: string;
  status: "valid";
}

const groupId = "ch16_functions";
const choiceIds = ["a", "b", "c", "d"];

function checksum(problem: Pick<Problem, "topic_id" | "difficulty" | "prompt_latex" | "correct_answer">): string {
  const payload = problem.topic_id + problem.difficulty + problem.prompt_latex + problem.correct_answer;
  return "sha256-" + crypto.createHash("sha256").update(payload).digest("hex");
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function pick(values: number[], i: number): number {
  const base = values[mod(i, values.length)];
  const cycle = Math.floor(Math.abs(i) / values.length);
  if (cycle === 0) return base;
  return base === 0 ? cycle : base + Math.sign(base) * cycle;
}

function signedTerm(n: number): string {
  return n < 0 ? `- ${Math.abs(n)}` : `+ ${n}`;
}

function signedCompact(n: number): string {
  return n < 0 ? `-${Math.abs(n)}` : `+${n}`;
}

function linearExpr(a: number, b: number, variable = "x"): string {
  const coeff = a === 1 ? variable : a === -1 ? `-${variable}` : `${a}${variable}`;
  if (b === 0) return coeff;
  return `${coeff} ${signedTerm(b)}`;
}

function compactLinearExpr(a: number, b: number, variable = "x"): string {
  const coeff = a === 1 ? variable : a === -1 ? `-${variable}` : `${a}${variable}`;
  if (b === 0) return coeff;
  return `${coeff}${signedCompact(b)}`;
}

function quadraticExpr(a: number, b: number, c: number): string {
  const first = a === 1 ? "x^2" : `${a}x^2`;
  const second = b === 0 ? "" : ` ${signedTerm(b)}x`;
  const third = c === 0 ? "" : ` ${signedTerm(c)}`;
  return `${first}${second}${third}`;
}

function parenIfNegative(n: number): string {
  return n < 0 ? `(${n})` : `${n}`;
}

function frac(num: number, den: number): string {
  if (den < 0) return frac(-num, -den);
  const g = gcd(Math.abs(num), Math.abs(den));
  return `${num / g}/${den / g}`;
}

function gcd(a: number, b: number): number {
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

function valueLatex(answerType: AnswerType, value: string): string {
  if (answerType === "integer" || answerType === "fraction" || answerType === "decimal") return `$${value}$`;
  return `$${value}$`;
}

function uniqueChoices(correct: ChoiceInput, distractors: ChoiceInput[], answerType: AnswerType): ChoiceInput[] {
  const seen = new Set<string>();
  const result: ChoiceInput[] = [];
  for (const candidate of [correct, ...distractors]) {
    const key = candidate.value.replace(/\s+/g, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(candidate);
  }
  let bump = 1;
  while (result.length < 4) {
    const base = Number(correct.value);
    const fallback = Number.isInteger(base) ? `${base + bump}` : `${correct.value}+${bump}`;
    const key = fallback.replace(/\s+/g, "").toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ value: fallback, latex: valueLatex(answerType, fallback) });
    }
    bump += 1;
  }
  return result.slice(0, 4);
}

function buildProblem(args: {
  index: number;
  topicId: string;
  difficulty: Difficulty;
  prompt: string;
  correct: ChoiceInput;
  distractors: ChoiceInput[];
  answerType: AnswerType;
  acceptedForms?: string[];
  solution: string;
  complexity: number;
  section: string;
  tags: string[];
}): Problem {
  const allChoices = uniqueChoices(args.correct, args.distractors, args.answerType);
  const shift = mod(args.index * 7 + args.topicId.length + args.difficulty.length, 4);
  const ordered = allChoices.map((_, j) => allChoices[mod(j - shift, 4)]);
  const correctIndex = ordered.findIndex((choice) => choice.value === args.correct.value);
  const problem: Problem = {
    id: `${args.topicId}.${args.difficulty}.${String(args.index + 1).padStart(4, "0")}`,
    topic_id: args.topicId,
    group_id: groupId,
    difficulty: args.difficulty,
    prompt_latex: args.prompt,
    answer_format: "mc",
    choices: ordered.map((choice, j) => ({ id: choiceIds[j], latex: choice.latex ?? valueLatex(args.answerType, choice.value) })),
    correct_choice: choiceIds[correctIndex],
    correct_answer: args.correct.value,
    answer_type: args.answerType,
    accepted_forms: args.acceptedForms ?? [],
    solution_latex: args.solution,
    complexity_factor: args.complexity,
    source_section: args.section,
    tags: args.tags,
    checksum: "",
    status: "valid",
  };
  problem.checksum = checksum(problem);
  return problem;
}

function generateTheMachine(difficulty: Difficulty, index: number): Problem {
  const topicId = "ch16.the_machine";
  if (difficulty === "easy") {
    const a = pick([2, 3, 4, 5, 6, 7, 8, 9], index);
    const b = pick([-7, -5, -3, 1, 2, 4, 6, 8], index * 3);
    const n = pick([-4, -3, -2, -1, 0, 1, 2, 3, 4, 5], index * 5 + 1);
    const answer = a * n + b;
    return buildProblem({
      index,
      topicId,
      difficulty,
      prompt: `Let $f(x)=${linearExpr(a, b)}$. Find $f(${n})$.`,
      correct: { value: `${answer}` },
      distractors: [{ value: `${a + n + b}` }, { value: `${a * n - b}` }, { value: `${a * (n + b)}` }],
      answerType: "integer",
      solution: `Substitute $x=${n}$: $f(${n})=${a}\cdot ${parenIfNegative(n)} ${signedTerm(b)}=${answer}$.`,
      complexity: 1.0,
      section: "16.1",
      tags: ["functions", "evaluation"],
    });
  }
  if (difficulty === "medium") {
    const a = pick([1, 2, 3, 4], index);
    const b = pick([-5, -3, -1, 2, 4, 6], index * 2);
    const c = pick([-8, -4, -2, 1, 3, 5], index * 3 + 1);
    const n = pick([-5, -4, -3, -2, -1, 2, 3, 4, 5], index * 5);
    const answer = a * n * n + b * n + c;
    return buildProblem({
      index,
      topicId,
      difficulty,
      prompt: `For $f(x)=${quadraticExpr(a, b, c)}$, find $f(${n})$.`,
      correct: { value: `${answer}` },
      distractors: [{ value: `${a * n * n - b * n + c}` }, { value: `${a * n + b * n + c}` }, { value: `${a * n * n + b * n - c}` }],
      answerType: "integer",
      solution: `Evaluate $${a}\cdot ${parenIfNegative(n)}^2 ${signedTerm(b)}\cdot ${parenIfNegative(n)} ${signedTerm(c)}=${answer}$.`,
      complexity: 1.15,
      section: "16.1",
      tags: ["functions", "evaluation", "quadratic"],
    });
  }
  const a = pick([2, 3, 4, 5, -2, -3], index);
  const b = pick([-6, -4, -1, 2, 5, 7], index * 2 + 1);
  const n = pick([-4, -3, -2, -1, 1, 2, 3, 4, 5], index * 3);
  const target = a * (a * n + b) + b;
  return buildProblem({
    index,
    topicId,
    difficulty,
    prompt: `Let $f(x)=${linearExpr(a, b)}$. If $f(f(n))=${target}$, find $n$.`,
    correct: { value: `${n}` },
    distractors: [{ value: `${a * n + b}` }, { value: `${n + 1}` }, { value: `${-n}` }],
    answerType: "integer",
    solution: `Since $f(f(n))=${a}(${linearExpr(a, b, "n")}) ${signedTerm(b)}=${a * a}n ${signedTerm(a * b + b)}$, solving $${a * a}n ${signedTerm(a * b + b)}=${target}$ gives $n=${n}$.`,
    complexity: 1.3,
    section: "16.1",
    tags: ["functions", "evaluation", "composition"],
  });
}

function generateCombining(difficulty: Difficulty, index: number): Problem {
  const topicId = "ch16.combining";
  const a = pick([2, 3, 4, 5, -2, -3], index);
  const b = pick([-5, -2, 1, 4, 7], index * 2);
  const c = pick([1, 2, 3, -1, -4], index * 3 + 1);
  const d = pick([-6, -3, 2, 5, 8], index * 5);
  if (difficulty === "easy") {
    const n = pick([-3, -2, -1, 0, 1, 2, 3, 4], index * 7);
    const plus = index % 2 === 0;
    const answer = plus ? (a * n + b) + (c * n + d) : (a * n + b) - (c * n + d);
    const op = plus ? "+" : "-";
    return buildProblem({
      index,
      topicId,
      difficulty,
      prompt: `Let $f(x)=${linearExpr(a, b)}$ and $g(x)=${linearExpr(c, d)}$. Find $(f${op}g)(${n})$.`,
      correct: { value: `${answer}` },
      distractors: [{ value: `${plus ? a * n + b - (c * n + d) : a * n + b + c * n + d}` }, { value: `${a * n + c * n + b - d}` }, { value: `${answer + n}` }],
      answerType: "integer",
      solution: `$f(${n})=${a * n + b}$ and $g(${n})=${c * n + d}$, so $(f${op}g)(${n})=${answer}$.`,
      complexity: 1.05,
      section: "16.2",
      tags: ["functions", "combining", "evaluation"],
    });
  }
  if (difficulty === "medium") {
    const plus = index % 3 !== 0;
    const slope = plus ? a + c : a - c;
    const intercept = plus ? b + d : b - d;
    const op = plus ? "+" : "-";
    const correct = compactLinearExpr(slope, intercept);
    return buildProblem({
      index,
      topicId,
      difficulty,
      prompt: `Let $f(x)=${linearExpr(a, b)}$ and $g(x)=${linearExpr(c, d)}$. Which expression equals $(f${op}g)(x)$?`,
      correct: { value: correct, latex: `$${linearExpr(slope, intercept)}$` },
      distractors: [
        { value: compactLinearExpr(plus ? a - c : a + c, plus ? b - d : b + d), latex: `$${linearExpr(plus ? a - c : a + c, plus ? b - d : b + d)}$` },
        { value: compactLinearExpr(slope, plus ? b - d : b + d), latex: `$${linearExpr(slope, plus ? b - d : b + d)}$` },
        { value: compactLinearExpr(plus ? a + d : a - d, plus ? b + c : b - c), latex: `$${linearExpr(plus ? a + d : a - d, plus ? b + c : b - c)}$` },
      ],
      answerType: "expression",
      acceptedForms: [`${slope}*x${signedCompact(intercept)}`],
      solution: `Combine like terms: $(${linearExpr(a, b)})${op}(${linearExpr(c, d)})=${linearExpr(slope, intercept)}$.`,
      complexity: 1.15,
      section: "16.2",
      tags: ["functions", "combining", "expressions"],
    });
  }
  const n = pick([-4, -2, -1, 1, 2, 3, 5], index * 2);
  const target = (a + c) * n + (b + d);
  return buildProblem({
    index,
    topicId,
    difficulty,
    prompt: `Let $f(x)=${linearExpr(a, b)}$ and $g(x)=${linearExpr(c, d)}$. If $(f+g)(x)=${target}$, find $x$.`,
    correct: { value: `${n}` },
    distractors: [{ value: `${-n}` }, { value: `${n + 1}` }, { value: `${target}` }],
    answerType: "integer",
    solution: `We have $(f+g)(x)=${linearExpr(a + c, b + d)}$. Solving $${linearExpr(a + c, b + d)}=${target}$ gives $x=${n}$.`,
    complexity: 1.3,
    section: "16.2",
    tags: ["functions", "combining", "linear-equations"],
  });
}

function generateComposition(difficulty: Difficulty, index: number): Problem {
  const topicId = "ch16.composition";
  const a = pick([2, 3, 4, -2, -3], index);
  const b = pick([-6, -3, 1, 4, 7], index * 2);
  const c = pick([2, 5, -1, -2, 3], index * 3 + 1);
  const d = pick([-5, -2, 3, 6], index * 5);
  if (difficulty === "easy") {
    const n = pick([-3, -2, -1, 0, 1, 2, 3, 4], index * 7);
    const g = c * n + d;
    const answer = a * g + b;
    return buildProblem({
      index,
      topicId,
      difficulty,
      prompt: `Let $f(x)=${linearExpr(a, b)}$ and $g(x)=${linearExpr(c, d)}$. Find $f(g(${n}))$.`,
      correct: { value: `${answer}` },
      distractors: [{ value: `${c * (a * n + b) + d}` }, { value: `${a * n + b + c * n + d}` }, { value: `${a * n + b}` }],
      answerType: "integer",
      solution: `First $g(${n})=${g}$. Then $f(${g})=${answer}$.`,
      complexity: 1.1,
      section: "16.3",
      tags: ["functions", "composition", "evaluation"],
    });
  }
  if (difficulty === "medium") {
    const slope = a * c;
    const intercept = a * d + b;
    const reverseSlope = c * a;
    const reverseIntercept = c * b + d;
    return buildProblem({
      index,
      topicId,
      difficulty,
      prompt: `Let $f(x)=${linearExpr(a, b)}$ and $g(x)=${linearExpr(c, d)}$. Which expression equals $f(g(x))$?`,
      correct: { value: compactLinearExpr(slope, intercept), latex: `$${linearExpr(slope, intercept)}$` },
      distractors: [
        { value: compactLinearExpr(reverseSlope, reverseIntercept), latex: `$${linearExpr(reverseSlope, reverseIntercept)}$` },
        { value: compactLinearExpr(a + c, b + d), latex: `$${linearExpr(a + c, b + d)}$` },
        { value: compactLinearExpr(slope, b + d), latex: `$${linearExpr(slope, b + d)}$` },
      ],
      answerType: "expression",
      acceptedForms: [`${slope}*x${signedCompact(intercept)}`],
      solution: `Substitute $g(x)$ into $f$: $f(g(x))=${a}(${linearExpr(c, d)}) ${signedTerm(b)}=${linearExpr(slope, intercept)}$.`,
      complexity: 1.2,
      section: "16.3",
      tags: ["functions", "composition", "expressions"],
    });
  }
  const n = pick([-5, -3, -2, -1, 1, 2, 4, 5], index * 2);
  const target = a * (c * n + d) + b;
  return buildProblem({
    index,
    topicId,
    difficulty,
    prompt: `Let $f(x)=${linearExpr(a, b)}$ and $g(x)=${linearExpr(c, d)}$. If $f(g(x))=${target}$, find $x$.`,
    correct: { value: `${n}` },
    distractors: [{ value: `${-n}` }, { value: `${n + 1}` }, { value: `${c * n + d}` }],
    answerType: "integer",
    solution: `$f(g(x))=${linearExpr(a * c, a * d + b)}$. Solving $${linearExpr(a * c, a * d + b)}=${target}$ gives $x=${n}$.`,
    complexity: 1.35,
    section: "16.3",
    tags: ["functions", "composition", "linear-equations"],
  });
}

function inverseFormula(a: number, b: number): { value: string; latex: string } {
  const numerator = b > 0 ? `x - ${b}` : b < 0 ? `x + ${Math.abs(b)}` : "x";
  return { value: `(${numerator.replace(/\s+/g, "")})/${a}`, latex: `$(${numerator})/${a}$` };
}

function generateInverse(difficulty: Difficulty, index: number): Problem {
  const topicId = "ch16.inverse";
  const a = pick([2, 3, 4, 5, 6, 7, 8, 9], index);
  const b = pick([-7, -4, -1, 2, 5, 8], index * 2);
  if (difficulty === "easy") {
    const n = pick([-5, -3, -2, -1, 1, 2, 4, 5], index * 3);
    const y = a * n + b;
    return buildProblem({
      index,
      topicId,
      difficulty,
      prompt: `Let $f(x)=${linearExpr(a, b)}$. Find $f^{-1}(${y})$.`,
      correct: { value: `${n}` },
      distractors: [{ value: `${y}` }, { value: `${n + 2}` }, { value: `${n + 1}` }],
      answerType: "integer",
      solution: `The equation $${linearExpr(a, b)}=${y}$ gives $x=${n}$, so $f^{-1}(${y})=${n}$.`,
      complexity: 1.1,
      section: "16.4",
      tags: ["functions", "inverse"],
    });
  }
  if (difficulty === "medium") {
    const correct = inverseFormula(a, b);
    const wrongOne = inverseFormula(a, -b);
    return buildProblem({
      index,
      topicId,
      difficulty,
      prompt: `Let $f(x)=${linearExpr(a, b)}$. Which expression equals $f^{-1}(x)$?`,
      correct,
      distractors: [wrongOne, { value: `${a}x${signedCompact(-b)}`, latex: `$${linearExpr(a, -b)}$` }, { value: `(x${signedCompact(b)})/${a}`, latex: `$(x ${signedTerm(b)})/${a}$` }],
      answerType: "expression",
      acceptedForms: [`(1/${a})*(x${signedCompact(-b)})`],
      solution: `Set $y=${linearExpr(a, b)}$ and solve for $x$: $x=(y ${signedTerm(-b)})/${a}$. Replace $y$ by $x$.`,
      complexity: 1.2,
      section: "16.4",
      tags: ["functions", "inverse", "expressions"],
    });
  }
  const c = pick([2, 3, 4, -2, -3], index * 3 + 1);
  const useN = pick([-4, -2, -1, 1, 2, 3, 5], index * 7);
  const finalAnswer = pick([-5, -3, -1, 2, 4, 6, 8], index * 11);
  const useG = a * finalAnswer + b;
  const d = useG - c * useN;
  return buildProblem({
    index,
    topicId,
    difficulty,
    prompt: `Let $f(x)=${linearExpr(a, b)}$ and $g(x)=${linearExpr(c, d)}$. Find $(f^{-1}\circ g)(${useN})$.`,
    correct: { value: `${finalAnswer}` },
    distractors: [{ value: `${a * useG + b}` }, { value: `${c * (a * useN + b) + d}` }, { value: `${finalAnswer + 1}` }],
    answerType: "integer",
    solution: `First $g(${useN})=${useG}$. Since $f^{-1}(y)=(y ${signedTerm(-b)})/${a}$, $(f^{-1}\circ g)(${useN})=${finalAnswer}$.`,
    complexity: 1.35,
    section: "16.4",
    tags: ["functions", "inverse", "composition"],
  });
}

function generateProblemSolving(difficulty: Difficulty, index: number): Problem {
  const topicId = "ch16.problem_solving";
  if (difficulty === "easy") {
    const rate = pick([3, 4, 5, 6, 7, 8, 9], index);
    const fee = pick([2, 5, 10, 12, 15], index * 2) + index;
    const hours = pick([2, 3, 4, 5, 6, 7, 8], index * 3);
    const answer = rate * hours + fee;
    return buildProblem({
      index,
      topicId,
      difficulty,
      prompt: `A game shop charges a $${fee}$ dollar entry fee plus $${rate}$ dollars per hour. If $C(h)=${rate}h+${fee}$, find $C(${hours})$.`,
      correct: { value: `${answer}` },
      distractors: [{ value: `${rate + hours + fee}` }, { value: `${rate * hours}` }, { value: `${rate * (hours + fee)}` }],
      answerType: "integer",
      solution: `Substitute $h=${hours}$: $C(${hours})=${rate}\cdot ${hours}+${fee}=${answer}$.`,
      complexity: 1.05,
      section: "16.5",
      tags: ["functions", "word-problem", "evaluation"],
    });
  }
  if (difficulty === "medium") {
    const rate = pick([4, 5, 6, 7, 8, 9, 10], index);
    const fee = pick([6, 8, 12, 15, 18], index * 2);
    const hours = pick([3, 4, 5, 6, 7, 8, 9], index * 3 + 1);
    const total = rate * hours + fee;
    return buildProblem({
      index,
      topicId,
      difficulty,
      prompt: `A tutor charges a fixed fee of $${fee}$ dollars and $${rate}$ dollars per session, so $T(s)=${rate}s+${fee}$. If $T(s)=${total}$, find $s$.`,
      correct: { value: `${hours}` },
      distractors: [{ value: `${hours + 1}` }, { value: `${hours + fee}` }, { value: `${total - fee}` }],
      answerType: "integer",
      solution: `Solve $${rate}s+${fee}=${total}$. Then $${rate}s=${total - fee}$, so $s=${hours}$.`,
      complexity: 1.2,
      section: "16.5",
      tags: ["functions", "word-problem", "linear-equations"],
    });
  }
  const a = pick([2, 3, 4, 5], index);
  const b = pick([1, 2, 3, 4, 5, 6], index * 2);
  const n = pick([2, 3, 4, 5, 6, 7], index * 3);
  const afterTwo = a * (a * n + b) + b;
  return buildProblem({
    index,
    topicId,
    difficulty,
    prompt: `A number machine multiplies the input by ${a} and then adds ${b}. After the machine is used twice, the output is ${afterTwo}. What was the original input?`,
    correct: { value: `${n}` },
    distractors: [{ value: `${a * n + b}` }, { value: `${n + b}` }, { value: `${afterTwo - b}` }],
    answerType: "integer",
    solution: `The machine is $M(x)=${a}x+${b}$. Thus $M(M(x))=${a * a}x+${a * b + b}$. Solving $${a * a}x+${a * b + b}=${afterTwo}$ gives $x=${n}$.`,
    complexity: 1.4,
    section: "16.5",
    tags: ["functions", "word-problem", "composition"],
  });
}

function generateOperations(difficulty: Difficulty, index: number): Problem {
  const topicId = "ch16.operations";
  const p = pick([2, 3, 4, 5, -2, -3], index);
  const q = pick([1, 2, 3, 4, -1, -2], index * 2 + 1);
  if (difficulty === "easy") {
    const a = pick([-3, -2, -1, 1, 2, 3, 4, 5], index * 3);
    const b = pick([-4, -2, 0, 1, 3, 5], index * 5);
    const answer = p * a + q * b;
    return buildProblem({
      index,
      topicId,
      difficulty,
      prompt: `Define $a\star b=${p}a ${signedTerm(q)}b$. Find $${a}\star ${b}$.`,
      correct: { value: `${answer}` },
      distractors: [{ value: `${p * b + q * a}` }, { value: `${p * a - q * b}` }, { value: `${a + b + p + q}` }],
      answerType: "integer",
      solution: `$${a}\star ${b}=${p}\cdot ${parenIfNegative(a)} ${signedTerm(q)}\cdot ${parenIfNegative(b)}=${answer}$.`,
      complexity: 1.05,
      section: "16.6",
      tags: ["functions", "operations", "evaluation"],
    });
  }
  if (difficulty === "medium") {
    const b = pick([-3, -1, 2, 4, 5], index * 3);
    const x = pick([-4, -2, -1, 1, 3, 5, 6], index * 5);
    const target = p * x + q * b;
    return buildProblem({
      index,
      topicId,
      difficulty,
      prompt: `Define $a\star b=${p}a ${signedTerm(q)}b$. If $x\star ${b}=${target}$, find $x$.`,
      correct: { value: `${x}` },
      distractors: [{ value: `${target}` }, { value: `${x + 1}` }, { value: `${-x}` }],
      answerType: "integer",
      solution: `$x\star ${b}=${p}x ${signedTerm(q)}\cdot ${parenIfNegative(b)}=${target}$. Solving gives $x=${x}$.`,
      complexity: 1.2,
      section: "16.6",
      tags: ["functions", "operations", "linear-equations"],
    });
  }
  const a = pick([-2, -1, 1, 2, 3, 4], index * 3);
  const b = pick([-3, -1, 2, 5], index * 5);
  const c = pick([-2, 1, 3, 4], index * 7);
  const inner = p * b + q * c;
  const answer = p * a + q * inner;
  return buildProblem({
    index,
    topicId,
    difficulty,
    prompt: `Define $a\star b=${p}a ${signedTerm(q)}b$. Find $${a}\star(${b}\star ${c})$.`,
    correct: { value: `${answer}` },
    distractors: [{ value: `${p * (p * a + q * b) + q * c}` }, { value: `${p * a + q * b + c}` }, { value: `${p * a + q * (b + c)}` }],
    answerType: "integer",
    solution: `First $${b}\star ${c}=${inner}$. Then $${a}\star ${inner}=${p}\cdot ${parenIfNegative(a)} ${signedTerm(q)}\cdot ${parenIfNegative(inner)}=${answer}$.`,
    complexity: 1.35,
    section: "16.6",
    tags: ["functions", "operations", "composition"],
  });
}

const generators: Record<string, (difficulty: Difficulty, index: number) => Problem> = {
  "ch16.the_machine": generateTheMachine,
  "ch16.combining": generateCombining,
  "ch16.composition": generateComposition,
  "ch16.inverse": generateInverse,
  "ch16.problem_solving": generateProblemSolving,
  "ch16.operations": generateOperations,
};

const difficulties: Difficulty[] = ["easy", "medium", "hard"];
const outDir = path.join(process.cwd(), "content", "problems", groupId);
fs.mkdirSync(outDir, { recursive: true });

for (const [topicId, generator] of Object.entries(generators)) {
  for (const difficulty of difficulties) {
    const problems = Array.from({ length: 50 }, (_, index) => generator(difficulty, index));
    const filePath = path.join(outDir, `${topicId}.${difficulty}.json`);
    fs.writeFileSync(filePath, JSON.stringify(problems, null, 2) + "\n");
  }
}

console.log(`Generated ${Object.keys(generators).length * difficulties.length * 50} Chapter 16 problems.`);
