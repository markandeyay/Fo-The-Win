import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

type Difficulty = "easy" | "medium" | "hard";

interface Choice {
  id: string;
  latex: string;
}

interface Problem {
  id: string;
  topic_id: string;
  group_id: string;
  difficulty: Difficulty;
  prompt_latex: string;
  answer_format: "mc";
  choices: Choice[];
  correct_choice: string;
  correct_answer: string;
  answer_type: "integer" | "fraction" | "decimal" | "expression" | "string";
  accepted_forms: string[];
  solution_latex: string;
  complexity_factor: number;
  source_section: string;
  tags: string[];
  checksum: string;
  status: string;
}

const COUNT = 50;
const GROUP_ID = "ch3_one_var_linear";

function computeChecksum(problem: Partial<Problem>): string {
  const payload =
    (problem.topic_id ?? "") +
    (problem.difficulty ?? "") +
    (problem.prompt_latex ?? "") +
    (problem.correct_answer ?? "");
  return "sha256-" + crypto.createHash("sha256").update(payload).digest("hex");
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

function reduceFraction(num: number, den: number): { num: number; den: number } {
  if (den === 0) return { num: 0, den: 1 };
  if (den < 0) {
    num = -num;
    den = -den;
  }
  const g = gcd(num, den);
  return { num: num / g, den: den / g };
}

function formatFraction(num: number, den: number): string {
  const r = reduceFraction(num, den);
  return `${r.num}/${r.den}`;
}

function formatLatexFraction(num: number, den: number): string {
  const r = reduceFraction(num, den);
  return `\\dfrac{${r.num}}{${r.den}}`;
}

function isInteger(n: number): boolean {
  return Number.isInteger(n);
}

function answerTypeFromNumber(n: number): "integer" | "fraction" | "decimal" {
  if (isInteger(n)) return "integer";
  const tol = 1e-9;
  const approx = Math.round(n * 1000) / 1000;
  if (Math.abs(n - approx) < tol && Math.abs(approx) < 1e6) {
    const frac = reduceFraction(Math.round(n * 1000), 1000);
    if (frac.den <= 1000) return "fraction";
  }
  return "decimal";
}

function findSimpleFraction(n: number): { num: number; den: number } | null {
  const tol = 1e-9;
  for (let d = 1; d <= 100; d++) {
    const num = Math.round(n * d);
    if (Math.abs(num / d - n) < tol) {
      return reduceFraction(num, d);
    }
  }
  return null;
}

function formatAnswer(n: number, type: "integer" | "fraction" | "decimal"): string {
  if (type === "integer") return `${Math.round(n)}`;
  if (type === "fraction") {
    const frac = findSimpleFraction(n);
    if (frac) return formatFraction(frac.num, frac.den);
    return `${parseFloat(n.toFixed(4))}`;
  }
  return `${parseFloat(n.toFixed(4))}`;
}

function formatLatexAnswer(n: number, type: "integer" | "fraction" | "decimal"): string {
  if (type === "integer") return `${Math.round(n)}`;
  if (type === "fraction") {
    const frac = findSimpleFraction(n);
    if (frac) return formatLatexFraction(frac.num, frac.den);
    return `${parseFloat(n.toFixed(4))}`;
  }
  return `${parseFloat(n.toFixed(4))}`;
}

function coerceToType(n: number, type: "integer" | "fraction" | "decimal"): number {
  if (type === "integer") return Math.round(n);
  if (type === "decimal") return parseFloat(n.toFixed(4));
  return n;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeChoices(
  correct: number,
  correctType: "integer" | "fraction" | "decimal",
  distractors: number[]
): { choices: Choice[]; correct_choice: string; correct_answer: string } {
  const uniqueDistractors: number[] = [];
  const seen = new Set<string>();
  const correctKey = formatAnswer(correct, correctType);
  seen.add(correctKey);
  for (const d of distractors) {
    const coerced = coerceToType(d, correctType);
    const key = formatAnswer(coerced, correctType);
    if (!seen.has(key)) {
      seen.add(key);
      uniqueDistractors.push(coerced);
    }
    if (uniqueDistractors.length >= 3) break;
  }
  let fallbackOffset = 1;
  while (uniqueDistractors.length < 3) {
    const candidate = correct + (Math.random() > 0.5 ? fallbackOffset : -fallbackOffset);
    const coerced = coerceToType(candidate, correctType);
    const key = formatAnswer(coerced, correctType);
    if (!seen.has(key)) {
      seen.add(key);
      uniqueDistractors.push(coerced);
    }
    fallbackOffset++;
  }

  const choicesRaw = [
    { correct: true, value: correct },
    { correct: false, value: uniqueDistractors[0] },
    { correct: false, value: uniqueDistractors[1] },
    { correct: false, value: uniqueDistractors[2] },
  ];
  const shuffled = shuffle(choicesRaw);
  const choices: Choice[] = shuffled.map((c, i) => ({
    id: String.fromCharCode(97 + i),
    latex: `$${formatLatexAnswer(c.value, correctType)}$`,
  }));
  const correctIndex = shuffled.findIndex((c) => c.correct);
  return {
    choices,
    correct_choice: String.fromCharCode(97 + correctIndex),
    correct_answer: correctKey,
  };
}

function buildProblem(
  topic_id: string,
  difficulty: Difficulty,
  index: number,
  prompt: string,
  answer: number,
  solution: string,
  distractors: number[],
  complexity: number,
  sourceSection: string,
  tags: string[]
): Problem {
  const type = answerTypeFromNumber(answer);
  const { choices, correct_choice, correct_answer } = makeChoices(answer, type, distractors);
  const id = `${topic_id}.${difficulty}.${String(index).padStart(4, "0")}`;
  const problem: Problem = {
    id,
    topic_id,
    group_id: GROUP_ID,
    difficulty,
    prompt_latex: prompt,
    answer_format: "mc",
    choices,
    correct_choice,
    correct_answer,
    answer_type: type,
    accepted_forms: type === "fraction" ? [formatAnswer(answer, type)] : [],
    solution_latex: solution,
    complexity_factor: complexity,
    source_section: sourceSection,
    tags,
    checksum: "",
    status: "valid",
  };
  problem.checksum = computeChecksum(problem);
  return problem;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// Topic 3.1: Solving Linear Equations I
// ---------------------------------------------------------------------------

function generateSolvingLinear1(difficulty: Difficulty): Problem {
  const topic = "ch3.solving_linear_1";
  const tags = ["linear_equations"];

  if (difficulty === "easy") {
    // one-step equations
    const templates = [
      () => {
        const a = randInt(2, 12);
        const x = randInt(1, 12);
        const b = a * x;
        const prompt = `Solve $${a}x = ${b}$.`;
        const solution = `Divide both sides by ${a}: $x = ${x}$.`;
        const distractors = [x + 1, x - 1, a * x];
        return buildProblem(topic, difficulty, 0, prompt, x, solution, distractors, 0.85, "3.1", tags);
      },
      () => {
        const x = randInt(2, 20);
        const a = randInt(2, 15);
        const prompt = `Solve $x + ${a} = ${x + a}$.`;
        const solution = `Subtract ${a} from both sides: $x = ${x}$.`;
        const distractors = [x + a, a - x, x + 1];
        return buildProblem(topic, difficulty, 0, prompt, x, solution, distractors, 0.8, "3.1", tags);
      },
      () => {
        const x = randInt(2, 20);
        const a = randInt(2, 15);
        const prompt = `Solve $x - ${a} = ${x - a}$.`;
        const solution = `Add ${a} to both sides: $x = ${x}$.`;
        const distractors = [x - a, a + x, x - 1];
        return buildProblem(topic, difficulty, 0, prompt, x, solution, distractors, 0.8, "3.1", tags);
      },
      () => {
        const x = randInt(2, 12);
        const a = randInt(2, 8);
        const b = a * x;
        const prompt = `Solve $\\dfrac{x}{${a}} = ${x}$.`;
        const solution = `Multiply both sides by ${a}: $x = ${b}$.`;
        const distractors = [x, b / a + 1, b - a];
        return buildProblem(topic, difficulty, 0, prompt, b, solution, distractors, 0.85, "3.1", tags);
      },
    ];
    return pick(templates)();
  }

  if (difficulty === "medium") {
    // two-step equations
    const templates = [
      () => {
        const a = randInt(2, 9);
        const x = randInt(2, 12);
        const b = randInt(2, 15);
        const c = a * x + b;
        const prompt = `Solve $${a}x + ${b} = ${c}$.`;
        const solution = `Subtract ${b}, then divide by ${a}: $x = ${x}$.`;
        const distractors = [c - b, (c + b) / a, c / a];
        return buildProblem(topic, difficulty, 0, prompt, x, solution, distractors, 0.95, "3.1", tags);
      },
      () => {
        const a = randInt(2, 9);
        const x = randInt(2, 12);
        const b = randInt(2, 15);
        const c = a * x - b;
        const prompt = `Solve $${a}x - ${b} = ${c}$.`;
        const solution = `Add ${b}, then divide by ${a}: $x = ${x}$.`;
        const distractors = [(c + b) / a + 1, c / a, (c - b) / a];
        return buildProblem(topic, difficulty, 0, prompt, x, solution, distractors, 0.95, "3.1", tags);
      },
      () => {
        const x = randInt(2, 12);
        const a = randInt(2, 8);
        const b = randInt(2, 10);
        const c = a * (x + b);
        const prompt = `Solve $${a}(x + ${b}) = ${c}$.`;
        const solution = `Divide by ${a}, then subtract ${b}: $x = ${x}$.`;
        const distractors = [c / a - b - 1, c / a, c / a + b];
        return buildProblem(topic, difficulty, 0, prompt, x, solution, distractors, 1.0, "3.1", tags);
      },
      () => {
        const x = randInt(2, 12);
        const a = randInt(2, 8);
        const b = randInt(2, 10);
        const c = x / a + b;
        const prompt = `Solve $\\dfrac{x}{${a}} + ${b} = ${c}$.`;
        const solution = `Subtract ${b}, then multiply by ${a}: $x = ${x}$.`;
        const distractors = [(c - b) * a + 1, (c + b) * a, c - b];
        return buildProblem(topic, difficulty, 0, prompt, x, solution, distractors, 1.0, "3.1", tags);
      },
    ];
    return pick(templates)();
  }

  // hard: multi-step, fractions/decimals, combining constants
  const templates = [
    () => {
      const a = randInt(2, 6);
      const x = randInt(2, 10);
      const b = randInt(1, 8);
      const c = randInt(1, 8);
      const rhs = a * x + b + c;
      const prompt = `Solve $${a}x + ${b} + ${c} = ${rhs}$.`;
      const solution = `Combine constants: $${a}x + ${b + c} = ${rhs}$. Then $x = ${x}$.`;
      const distractors = [(rhs - b - c + 1) / a, rhs / a, (rhs - b + c) / a];
      return buildProblem(topic, difficulty, 0, prompt, x, solution, distractors, 1.1, "3.1", tags);
    },
    () => {
      const a = randInt(2, 5);
      const x = randInt(3, 12);
      const b = randInt(1, 6);
      const c = a * (x - b) + randInt(1, 5);
      const prompt = `Solve $${a}(x - ${b}) + ${c - a * (x - b)} = ${c}$.`;
      // recompute to ensure integer: let inner = a*(x-b), add d to get c
      const d = randInt(1, 8);
      const inner = a * (x - b);
      const rhs = inner + d;
      const prompt2 = `Solve $${a}(x - ${b}) + ${d} = ${rhs}$.`;
      const solution = `Subtract ${d}, divide by ${a}, add ${b}: $x = ${x}$.`;
      const distractors = [(rhs - d) / a + b, (rhs + d) / a + b, rhs / a];
      return buildProblem(topic, difficulty, 0, prompt2, x, solution, distractors, 1.15, "3.1", tags);
    },
    () => {
      const xNum = randInt(1, 8);
      const xDen = randInt(2, 5);
      const x = xNum / xDen;
      const a = randInt(2, 6);
      const b = randInt(1, 6);
      const c = a * x + b;
      const prompt = `Solve $${a}x + ${b} = ${c}$.`;
      const solution = `Subtract ${b}, divide by ${a}: $x = \\dfrac{${xNum}}{${xDen}}$.`;
      const distractors = [c - b, (c - b) / a, c / a];
      return buildProblem(topic, difficulty, 0, prompt, x, solution, distractors, 1.2, "3.1", tags);
    },
  ];
  return pick(templates)();
}

// ---------------------------------------------------------------------------
// Topic 3.2: Solving Linear Equations II
// ---------------------------------------------------------------------------

function generateSolvingLinear2(difficulty: Difficulty): Problem {
  const topic = "ch3.solving_linear_2";
  const tags = ["linear_equations"];

  if (difficulty === "easy") {
    const templates = [
      () => {
        const x = randInt(2, 12);
        const a = randInt(2, 8);
        const b = randInt(1, 10);
        let c = randInt(2, 8);
        while (c === a) c = randInt(2, 8);
        const d = a * x + b - c * x;
        const prompt = `Solve $${a}x + ${b} = ${c}x + ${d}$.`;
        const solution = `Subtract $${c}x$, subtract ${b}: $${a - c}x = ${d - b}$. Divide: $x = ${x}$.`;
        const distractors = [x + 1, x - 1, (d - b) / (a - c) + 1];
        return buildProblem(topic, difficulty, 0, prompt, x, solution, distractors, 0.95, "3.2", tags);
      },
      () => {
        const x = randInt(2, 10);
        let a = randInt(2, 6);
        let b = randInt(2, 8);
        while (a === b) b = randInt(2, 8);
        const c = (a - b) * x;
        const prompt = `Solve $${a}x = ${b}x + ${c}$.`;
        const solution = `Subtract $${b}x$: $${a - b}x = ${c}$. Divide: $x = ${x}$.`;
        const distractors = [c / (a + b), x + 2, x - 2];
        return buildProblem(topic, difficulty, 0, prompt, x, solution, distractors, 0.9, "3.2", tags);
      },
    ];
    return pick(templates)();
  }

  if (difficulty === "medium") {
    const templates = [
      () => {
        const x = randInt(2, 10);
        const a = randInt(2, 6);
        const b = randInt(2, 8);
        let c = randInt(2, 6);
        while (c === a) c = randInt(2, 6);
        const d = a * (x + b) - c * x;
        const prompt = `Solve $${a}(x + ${b}) = ${c}x + ${d}$.`;
        const solution = `Distribute: $${a}x + ${a * b} = ${c}x + ${d}$. Then $x = ${x}$.`;
        const distractors = [x + 1, x - 1, (d - a * b) / (a - c) + 1];
        return buildProblem(topic, difficulty, 0, prompt, x, solution, distractors, 1.05, "3.2", tags);
      },
      () => {
        const x = randInt(2, 10);
        const a = randInt(2, 6);
        const b = randInt(2, 8);
        let c = randInt(2, 6);
        while (c === a) c = randInt(2, 6);
        const d = a * x - b - c * x;
        const prompt = `Solve $${a}x - ${b} = ${c}x + ${d}$.`;
        const solution = `Subtract $${c}x$, add ${b}: $${a - c}x = ${d + b}$. Divide: $x = ${x}$.`;
        const distractors = [x + 1, x - 1, (d + b) / (a - c) + 1];
        return buildProblem(topic, difficulty, 0, prompt, x, solution, distractors, 1.05, "3.2", tags);
      },
      () => {
        const x = randInt(2, 10);
        const a = randInt(2, 5);
        const b = randInt(2, 6);
        let c = randInt(2, 5);
        while (c === a) c = randInt(2, 5);
        let d = randInt(2, 6);
        while (d === b) d = randInt(2, 6);
        const rhs = c * (x + d);
        const lhs = a * (x + b);
        const prompt = `Solve $${a}(x + ${b}) = ${c}(x + ${d})$.`;
        const solution = `Distribute: $${a}x + ${a * b} = ${c}x + ${c * d}$. Then $x = ${x}$.`;
        const distractors = [x + 1, x - 1, (c * d - a * b) / (a - c) + 1];
        return buildProblem(topic, difficulty, 0, prompt, x, solution, distractors, 1.05, "3.2", tags);
      },
    ];
    return pick(templates)();
  }

  // hard
  const templates = [
    () => {
      const x = randInt(2, 10);
      const a = randInt(2, 5);
      const b = randInt(2, 6);
      const c = randInt(2, 5);
      let d = randInt(2, 6);
      while (a * b === d) d = randInt(2, 6);
      const e = a * (b * x + c) - d * x;
      const prompt = `Solve $${a}(${b}x + ${c}) = ${d}x + ${e}$.`;
      const solution = `Distribute: $${a * b}x + ${a * c} = ${d}x + ${e}$. Then $x = ${x}$.`;
      const distractors = [x + 1, x - 1, (e - a * c) / (a * b - d) + 1];
      return buildProblem(topic, difficulty, 0, prompt, x, solution, distractors, 1.2, "3.2", tags);
    },
    () => {
      const x = randInt(2, 10);
      const a = randInt(2, 5);
      const b = randInt(2, 6);
      let c = randInt(2, 5);
      while (c === a) c = randInt(2, 5);
      const d = randInt(2, 6);
      const e = a * x + b - c * (x - d);
      const prompt = `Solve $${a}x + ${b} = ${c}(x - ${d}) + ${e}$.`;
      const solution = `Distribute right side, collect terms: $x = ${x}$.`;
      const distractors = [x + 1, x - 1, (e + c * d - b) / (a - c) + 1];
      return buildProblem(topic, difficulty, 0, prompt, x, solution, distractors, 1.25, "3.2", tags);
    },
    () => {
      const x = randInt(2, 8);
      const a = randInt(2, 4);
      const b = randInt(2, 5);
      const c = randInt(2, 4);
      const d = randInt(2, 5);
      const e = randInt(1, 6);
      const f = a * (b * x + c) + d * x + e;
      const prompt = `Solve $${a}(${b}x + ${c}) + ${d}x + ${e} = ${f}$.`;
      const solution = `Distribute and combine: $${a * b + d}x + ${a * c + e} = ${f}$. Then $x = ${x}$.`;
      const distractors = [x + 1, x - 1, (f - a * c - e) / (a * b) + 1];
      return buildProblem(topic, difficulty, 0, prompt, x, solution, distractors, 1.25, "3.2", tags);
    },
  ];
  return pick(templates)();
}

// ---------------------------------------------------------------------------
// Topic 3.3: Word Problems
// ---------------------------------------------------------------------------

interface WordProblemSpec {
  prompt: string;
  answer: number;
  solution: string;
  distractors: number[];
  type: "integer" | "fraction" | "decimal" | "string";
  complexity: number;
}

function generateWordProblem(difficulty: Difficulty): WordProblemSpec {
  if (difficulty === "easy") {
    const templates = [
      (): WordProblemSpec => {
        const x = randInt(5, 25);
        const a = randInt(2, 10);
        const total = a * x;
        return {
          prompt: `If ${a} identical books cost ${total} dollars, how much does one book cost?`,
          answer: x,
          solution: `Let $x$ be the cost of one book. Then $${a}x = ${total}$, so $x = ${x}$.`,
          distractors: [total - a, total + a, total / a + 1],
          type: "integer",
          complexity: 0.9,
        };
      },
      (): WordProblemSpec => {
        const x = randInt(8, 30);
        const a = randInt(3, 12);
        const result = x + a;
        return {
          prompt: `A number plus ${a} equals ${result}. What is the number?`,
          answer: x,
          solution: `Let $x$ be the number. Then $x + ${a} = ${result}$, so $x = ${x}$.`,
          distractors: [result + a, a - x, result],
          type: "integer",
          complexity: 0.85,
        };
      },
      (): WordProblemSpec => {
        const x = randInt(10, 40);
        const discount = randInt(2, 10);
        const paid = x - discount;
        return {
          prompt: `After a ${discount} dollar discount, a game costs ${paid} dollars. What was the original price?`,
          answer: x,
          solution: `Let $x$ be the original price. Then $x - ${discount} = ${paid}$, so $x = ${x}$.`,
          distractors: [paid - discount, paid + discount + 1, paid],
          type: "integer",
          complexity: 0.9,
        };
      },
      (): WordProblemSpec => {
        const x = randInt(4, 12);
        const perBox = randInt(3, 8);
        const total = x * perBox;
        return {
          prompt: `There are ${total} cookies packed equally into ${x} boxes. How many cookies are in each box?`,
          answer: perBox,
          solution: `Let $x$ be cookies per box. Then $${x}x = ${total}$, so $x = ${perBox}$.`,
          distractors: [total + x, total - x, total / x + 1],
          type: "integer",
          complexity: 0.85,
        };
      },
    ];
    return pick(templates)();
  }

  if (difficulty === "medium") {
    const templates = [
      (): WordProblemSpec => {
        const x = randInt(2, 15);
        const a = randInt(2, 8);
        const b = randInt(1, 10);
        const total = a * x + b;
        return {
          prompt: `A plumber charges a ${b} dollar service fee plus ${a} dollars per hour. If a repair bill is ${total} dollars, how many hours did the repair take?`,
          answer: x,
          solution: `Let $h$ be hours. Then $${a}h + ${b} = ${total}$, so $h = ${x}$.`,
          distractors: [(total - b) / a + 1, total / a, total - b],
          type: "integer",
          complexity: 1.05,
        };
      },
      (): WordProblemSpec => {
        const small = randInt(3, 12);
        const diff = randInt(2, 10);
        const large = small + diff;
        const sum = small + large;
        return {
          prompt: `The larger of two numbers is ${diff} more than the smaller, and their sum is ${sum}. What is the smaller number?`,
          answer: small,
          solution: `Let $x$ be the smaller. Then $x + (x + ${diff}) = ${sum}$, so $2x = ${sum - diff}$ and $x = ${small}$.`,
          distractors: [large, sum / 2, diff],
          type: "integer",
          complexity: 1.0,
        };
      },
      (): WordProblemSpec => {
        const x = randInt(2, 12);
        const mult = randInt(2, 5);
        const added = randInt(1, 8);
        const result = mult * x + added;
        const multWord = ["", "", "two", "three", "four", "five"][mult];
        return {
          prompt: `${multWord.charAt(0).toUpperCase() + multWord.slice(1)} times a number plus ${added} equals ${result}. What is the number?`,
          answer: x,
          solution: `Let $x$ be the number. Then $${mult}x + ${added} = ${result}$, so $x = ${x}$.`,
          distractors: [(result + added) / mult, result / mult, result - added],
          type: "integer",
          complexity: 1.0,
        };
      },
      (): WordProblemSpec => {
        const x = randInt(2, 10);
        const y = randInt(2, 8);
        const totalCoins = x + y;
        const value = 5 * x + 10 * y;
        return {
          prompt: `Maya has ${totalCoins} coins consisting of nickels and dimes, worth ${value} cents total. How many nickels does she have?`,
          answer: x,
          solution: `Let $n$ be nickels. Then $5n + 10(${totalCoins} - n) = ${value}$, so $-5n = ${value - 10 * totalCoins}$ and $n = ${x}$.`,
          distractors: [y, totalCoins - x + 1, value / 5],
          type: "integer",
          complexity: 1.15,
        };
      },
    ];
    return pick(templates)();
  }

  // hard
  const templates = [
    (): WordProblemSpec => {
      const x = randInt(2, 12);
      const a = randInt(2, 5);
      const b = randInt(2, 6);
      const c = randInt(2, 5);
      const total = a * x + b * (x + c);
      return {
        prompt: `A store sells small packs for ${a} dollars and large packs for ${b} dollars. You buy ${c} more large packs than small packs and spend ${total} dollars total. How many small packs did you buy?`,
        answer: x,
        solution: `Let $x$ be small packs. Then $${a}x + ${b}(x + ${c}) = ${total}$, so $${a + b}x = ${total - b * c}$ and $x = ${x}$.`,
        distractors: [(total - b * c) / (a + b) + 1, total / (a + b), (total - a * c) / (a + b)],
        type: "integer",
        complexity: 1.25,
      };
    },
    (): WordProblemSpec => {
      const x = randInt(2, 12);
      const speed = randInt(30, 60);
      const time = x;
      const distance = speed * x;
      return {
        prompt: `A car travels at ${speed} miles per hour and covers ${distance} miles. How many hours did the trip take?`,
        answer: x,
        solution: `Let $t$ be hours. Then $${speed}t = ${distance}$, so $t = ${x}$.`,
        distractors: [distance + speed, distance - speed, distance / speed + 1],
        type: "integer",
        complexity: 1.1,
      };
    },
      (): WordProblemSpec => {
        const x = randInt(2, 12);
        const a = randInt(2, 6);
        const b = randInt(2, 6);
        const total = a * x + b * (2 * x);
        return {
          prompt: `Type A groups have ${a} students each and type B groups have ${b} students each. There are $x$ type A groups and $2x$ type B groups, totaling ${total} students. Find $x$.`,
          answer: x,
          solution: `Equation: $${a}x + ${b}(2x) = ${total}$, so $${a + 2 * b}x = ${total}$ and $x = ${x}$.`,
          distractors: [total / (a + b), total / (a + 2 * b) + 1, 2 * x],
          type: "integer",
          complexity: 1.2,
        };
      },
    (): WordProblemSpec => {
      const x = randInt(2, 12);
      const a = randInt(2, 6);
      const b = randInt(2, 6);
      const c = a * x;
      const d = b * x;
      const total = c + d;
      return {
        prompt: `Two machines produce items in a ratio of ${a}:${b}. Together they produce ${total} items. How many items did the first machine produce?`,
        answer: c,
        solution: `Let $x$ be the common scale. Then $${a}x + ${b}x = ${total}$, so $x = ${x}$ and the first machine made $${a}x = ${c}$.`,
        distractors: [d, total / (a + b), total - c],
        type: "integer",
        complexity: 1.25,
      };
    },
  ];
  return pick(templates)();
}

function generateWordProblems(difficulty: Difficulty): Problem {
  const topic = "ch3.word_problems";
  const spec = generateWordProblem(difficulty);
  const tags = ["word_problems", "linear_equations"];
  return buildProblem(
    topic,
    difficulty,
    0,
    spec.prompt,
    spec.answer,
    spec.solution,
    spec.distractors,
    spec.complexity,
    "3.3",
    tags
  );
}

// ---------------------------------------------------------------------------
// Topic 3.4: Linear Equations in Disguise
// ---------------------------------------------------------------------------

function generateLinearInDisguise(difficulty: Difficulty): Problem {
  const topic = "ch3.linear_in_disguise";
  const tags = ["linear_equations"];

  if (difficulty === "easy") {
    const templates = [
      () => {
        const x = randInt(2, 10);
        const a = randInt(2, 6);
        const b = randInt(2, 8);
        const c = randInt(2, 6);
        const lhs = a * x + b * x;
        const rhs = c * x + (lhs - c * x);
        const prompt = `Solve $${a}x + ${b}x = ${c}x + ${lhs - c * x}$.`;
        const solution = `Combine like terms: $${a + b}x = ${c}x + ${lhs - c * x}$. Then $x = ${x}$.`;
        const distractors = [(lhs - c * x) / (a + b), lhs / (a + b), (lhs - c * x) / c];
        return buildProblem(topic, difficulty, 0, prompt, x, solution, distractors, 0.95, "3.4", tags);
      },
      () => {
        const x = randInt(2, 10);
        const a = randInt(2, 6);
        const b = randInt(2, 8);
        const c = a * x + b;
        const prompt = `Solve $${a}x + ${b} = ${c} + 0x$ for $x$.`;
        const solution = `The $0x$ term vanishes: $${a}x + ${b} = ${c}$. Then $x = ${x}$.`;
        const distractors = [c / a, (c + b) / a, c - b];
        return buildProblem(topic, difficulty, 0, prompt, x, solution, distractors, 0.9, "3.4", tags);
      },
    ];
    return pick(templates)();
  }

  if (difficulty === "medium") {
    const templates = [
      () => {
        const x = randInt(2, 10);
        const a = randInt(2, 5);
        const b = randInt(2, 6);
        const c = randInt(2, 5);
        const d = a * x + b * (x - c);
        const prompt = `Solve $${a}x + ${b}(x - ${c}) = ${d}$.`;
        const solution = `Distribute: $${a}x + ${b}x - ${b * c} = ${d}$. Combine: $${a + b}x = ${d + b * c}$. Then $x = ${x}$.`;
        const distractors = [(d + b * c) / a, d / (a + b), (d - b * c) / (a + b)];
        return buildProblem(topic, difficulty, 0, prompt, x, solution, distractors, 1.1, "3.4", tags);
      },
      () => {
        const x = randInt(2, 10);
        const a = randInt(2, 5);
        const b = randInt(2, 6);
        const c = randInt(2, 5);
        const lhs = a * (b * x - c);
        const rhs = randInt(1, 20);
        // choose rhs so solution is integer: lhs = a*(b*x - c), solve for x -> x = (rhs/a + c)/b
        const x2 = randInt(2, 8);
        const rhs2 = a * (b * x2 - c);
        const prompt = `Solve $${a}(${b}x - ${c}) = ${rhs2}$.`;
        const solution = `Divide by ${a}: $${b}x - ${c} = ${rhs2 / a}$. Add ${c}, divide by ${b}: $x = ${x2}$.`;
        const distractors = [(rhs2 / a + c) / b + 1, rhs2 / (a * b), (rhs2 + c) / (a * b)];
        return buildProblem(topic, difficulty, 0, prompt, x2, solution, distractors, 1.15, "3.4", tags);
      },
      () => {
        const x = randInt(2, 10);
        const a = randInt(2, 5);
        const b = randInt(2, 6);
        const c = randInt(2, 5);
        const lhs = x / a + b;
        const rhs = x / c + (lhs - x / c);
        const prompt = `Solve $\\dfrac{x}{${a}} + ${b} = \\dfrac{x}{${c}} + ${rhs - x / c}$.`;
        const solution = `Subtract $\\dfrac{x}{${c}}$: $\\dfrac{x}{${a}} - \\dfrac{x}{${c}} = ${rhs - x / c - b}$. Then $x = ${x}$.`;
        const distractors = [(rhs - b) * a, (rhs - b) * c, (rhs - b) * a + c];
        return buildProblem(topic, difficulty, 0, prompt, x, solution, distractors, 1.2, "3.4", tags);
      },
    ];
    return pick(templates)();
  }

  // hard
  const templates = [
    () => {
      const x = randInt(2, 10);
      const a = randInt(2, 5);
      const b = randInt(2, 6);
      const c = randInt(2, 5);
      const d = randInt(2, 6);
      const e = randInt(1, 8);
      const lhs = a * (b * x + c);
      const rhs = d * (x + e);
      const prompt = `Solve $${a}(${b}x + ${c}) = ${d}(x + ${e})$.`;
      const solution = `Expand: $${a * b}x + ${a * c} = ${d}x + ${d * e}$. Then $x = ${x}$.`;
      const distractors = [(d * e - a * c) / (a * b), (d * e + a * c) / (a * b - d), d * e / (a * b)];
      return buildProblem(topic, difficulty, 0, prompt, x, solution, distractors, 1.35, "3.4", tags);
    },
    () => {
      const x = randInt(2, 10);
      const a = randInt(2, 4);
      const b = randInt(2, 5);
      const c = randInt(2, 4);
      const d = randInt(2, 5);
      const e = randInt(1, 6);
      const lhs = a * x + b;
      const rhs = c * (d * x - e);
      const prompt = `Solve $${a}x + ${b} = ${c}(${d}x - ${e})$.`;
      const solution = `Expand right side: $${a}x + ${b} = ${c * d}x - ${c * e}$. Then $x = ${x}$.`;
      const distractors = [(b + c * e) / (c * d), (c * e - b) / (a - c * d), (b + c * e) / a];
      return buildProblem(topic, difficulty, 0, prompt, x, solution, distractors, 1.4, "3.4", tags);
    },
    () => {
      const x = randInt(2, 10);
      const a = randInt(2, 4);
      const b = randInt(2, 5);
      const c = randInt(2, 4);
      const d = randInt(2, 5);
      const e = randInt(1, 6);
      const f = randInt(1, 6);
      const lhs = a * (b * x + c) + d * x;
      const rhs = e * x + f;
      // ensure x is solution
      const prompt = `Solve $${a}(${b}x + ${c}) + ${d}x = ${e}x + ${f + (lhs - e * x)}$.`;
      const solution = `Expand and collect: $${a * b + d}x + ${a * c} = ${e}x + ${f + (lhs - e * x)}$. Then $x = ${x}$.`;
      const distractors = [(f + (lhs - e * x) - a * c) / (a * b + d), (f + (lhs - e * x)) / (a * b + d - e), f / e];
      return buildProblem(topic, difficulty, 0, prompt, x, solution, distractors, 1.45, "3.4", tags);
    },
  ];
  return pick(templates)();
}

// ---------------------------------------------------------------------------
// Main generation
// ---------------------------------------------------------------------------

function generateForTopic(topic: string, difficulty: Difficulty): Problem[] {
  const problems: Problem[] = [];
  const seenChecksums = new Set<string>();
  let attempts = 0;
  console.log(`Generating ${topic} ${difficulty}...`);
  while (problems.length < COUNT && attempts < COUNT * 50) {
    attempts++;
    let p: Problem;
    switch (topic) {
      case "ch3.solving_linear_1":
        p = generateSolvingLinear1(difficulty);
        break;
      case "ch3.solving_linear_2":
        p = generateSolvingLinear2(difficulty);
        break;
      case "ch3.word_problems":
        p = generateWordProblems(difficulty);
        break;
      case "ch3.linear_in_disguise":
        p = generateLinearInDisguise(difficulty);
        break;
      default:
        throw new Error(`Unknown topic: ${topic}`);
    }
    p.id = `${topic}.${difficulty}.${String(problems.length + 1).padStart(4, "0")}`;
    p.checksum = computeChecksum(p);
    if (seenChecksums.has(p.checksum)) continue;
    seenChecksums.add(p.checksum);
    problems.push(p);
    if (problems.length % 10 === 0) {
      console.log(`  ${topic} ${difficulty}: ${problems.length}/${COUNT}`);
    }
  }
  if (problems.length < COUNT) {
    console.warn(`  ${topic} ${difficulty}: only generated ${problems.length} problems`);
  }
  return problems;
}

function main() {
  const outDir = path.join(process.cwd(), "content", "problems", GROUP_ID);
  fs.mkdirSync(outDir, { recursive: true });

  const topics = [
    "ch3.solving_linear_1",
    "ch3.solving_linear_2",
    "ch3.word_problems",
    "ch3.linear_in_disguise",
  ];
  const difficulties: Difficulty[] = ["easy", "medium", "hard"];

  for (const topic of topics) {
    for (const difficulty of difficulties) {
      const filePath = path.join(outDir, `${topic}.${difficulty}.json`);
      if (fs.existsSync(filePath)) {
        try {
          const existing = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          if (Array.isArray(existing) && existing.length === COUNT) {
            console.log(`Skipping ${filePath} (already has ${COUNT} problems)`);
            continue;
          }
        } catch {
          // ignore parse errors and regenerate
        }
      }
      const problems = generateForTopic(topic, difficulty);
      fs.writeFileSync(filePath, JSON.stringify(problems, null, 2));
      console.log(`Wrote ${problems.length} problems to ${filePath}`);
    }
  }
}

main();
