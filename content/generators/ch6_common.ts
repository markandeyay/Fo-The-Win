import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type AnswerType =
  | "integer"
  | "fraction"
  | "decimal"
  | "expression"
  | "ordered_pair"
  | "set"
  | "interval"
  | "boolean"
  | "string";
export type Difficulty = "easy" | "medium" | "hard";

export interface Choice {
  id: string;
  latex: string;
}

export interface Problem {
  id: string;
  topic_id: string;
  group_id: string;
  difficulty: Difficulty;
  prompt_latex: string;
  answer_format: "mc";
  choices: Choice[];
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

export const GROUP = "ch6_ratios_percents";

// RNG
function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

function sfc32(a: number, b: number, c: number, d: number) {
  return function () {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function createRng(seed: string): () => number {
  const [a, b, c, d] = cyrb128(seed);
  return sfc32(a, b, c, d);
}

export function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function randChoice<T>(rng: () => number, arr: T[]): T {
  return arr[randInt(rng, 0, arr.length - 1)];
}

export function shuffle<T>(rng: () => number, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

export function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

export function simplifyTerms(terms: number[]): number[] {
  const g = terms.reduce((acc, v) => gcd(acc, v), 0);
  return terms.map((v) => v / g);
}

export function formatFracLatex(n: number, d: number): string {
  return `\\frac{${n}}{${d}}`;
}

export function randomUntil<T>(
  rng: () => number,
  fn: (r: () => number) => T | null,
  max = 50
): T {
  for (let i = 0; i < max; i++) {
    const v = fn(rng);
    if (v !== null) return v;
  }
  throw new Error("Could not generate valid parameters");
}

export function computeChecksum(problem: Partial<Problem>): string {
  const payload =
    (problem.topic_id ?? "") +
    (problem.difficulty ?? "") +
    (problem.prompt_latex ?? "") +
    (problem.correct_answer ?? "");
  return "sha256-" + crypto.createHash("sha256").update(payload).digest("hex");
}

export function buildMC(
  correctLatex: string,
  distractors: string[],
  rng: () => number
): { choices: Choice[]; correct_choice: string } {
  const arr: { latex: string; correct: boolean; id?: string }[] = [
    { latex: correctLatex, correct: true },
    ...distractors.map((latex) => ({ latex, correct: false })),
  ];
  shuffle(rng, arr);
  const ids = ["a", "b", "c", "d"];
  arr.forEach((c, i) => (c.id = ids[i]));
  const choices: Choice[] = arr.map((c) => ({ id: c.id!, latex: c.latex }));
  const correct_choice = arr.find((c) => c.correct)!.id!;
  return { choices, correct_choice };
}

export function makeProblem(
  index: number,
  topic: string,
  diff: Difficulty,
  source: string,
  prompt: string,
  correctLatex: string,
  correctAnswer: string,
  answerType: AnswerType,
  distractors: string[],
  solution: string,
  complexity: number,
  tags: string[],
  rng: () => number
): Problem {
  const mc = buildMC(correctLatex, distractors, rng);
  const p: Problem = {
    id: `${topic}.${diff}.${String(index).padStart(4, "0")}`,
    topic_id: topic,
    group_id: GROUP,
    difficulty: diff,
    prompt_latex: prompt,
    answer_format: "mc",
    choices: mc.choices,
    correct_choice: mc.correct_choice,
    correct_answer: correctAnswer,
    answer_type: answerType,
    accepted_forms: [],
    solution_latex: solution,
    complexity_factor: complexity,
    source_section: source,
    tags,
    checksum: "",
    status: "valid",
  };
  p.checksum = computeChecksum(p);
  return p;
}

export function intDistractors(
  ans: number,
  rng: () => number,
  extras?: number[]
): string[] {
  const set = new Set<number>();
  const add = (x: number) => {
    if (Number.isInteger(x) && x !== ans) set.add(x);
  };
  add(ans + 1);
  add(ans - 1);
  add(ans + 2);
  add(ans - 2);
  if (ans !== 0) {
    add(Math.floor(ans / 2));
    add(ans * 2);
    add(-ans);
  }
  if (extras) extras.forEach(add);
  let n = ans + 10;
  while (set.size < 3) {
    add(n);
    n += randInt(rng, 1, 5);
  }
  return Array.from(set)
    .slice(0, 3)
    .map((x) => `$${x}$`);
}

export function fracDistractors(
  f: { n: number; d: number },
  rng: () => number
): string[] {
  const ansStr = `${f.n}/${f.d}`;
  const set = new Set<string>();
  const addFrac = (n: number, d: number) => {
    if (d === 0) return;
    const g = gcd(n, d);
    const s = `${n / g}/${d / g}`;
    if (s !== ansStr) set.add(s);
  };
  addFrac(f.n + 1, f.d);
  addFrac(f.n - 1, f.d);
  addFrac(f.n, f.d + 1);
  addFrac(f.n, f.d - 1);
  addFrac(f.d, f.n);
  addFrac(-f.n, f.d);
  addFrac(f.n + 2, f.d);
  if (set.size < 3) addFrac(f.n, f.d + 2);
  return Array.from(set)
    .slice(0, 3)
    .map((s) => {
      const [n, d] = s.split("/").map(Number);
      return `$\\frac{${n}}{${d}}$`;
    });
}

export function decimalDistractors(
  ans: number,
  rng: () => number
): string[] {
  const set = new Set<number>();
  const add = (x: number) => {
    const rounded = parseFloat(x.toFixed(3));
    if (Number.isFinite(rounded) && rounded !== ans) set.add(rounded);
  };
  add(ans * 10);
  add(ans / 10);
  add(ans + 1);
  add(ans - 1);
  add(ans * 0.5);
  add(ans + 0.1);
  if (set.size < 3) add(ans * 2);
  return Array.from(set)
    .slice(0, 3)
    .map((x) => `$${x}$`);
}

export function ratioDistractors(
  ratio: number[],
  rng: () => number
): string[] {
  const correct = ratio.join(":");
  const set = new Set<string>();
  const add = (r: number[]) => {
    const s = r.join(":");
    if (s !== correct) set.add(s);
  };
  add(ratio.map((x) => x + 1));
  add(ratio.map((x) => x - 1));
  add([...ratio].reverse());
  add(ratio.map((x) => x + 2));
  if (set.size < 3) add(ratio.map((x) => x + 3));
  return Array.from(set)
    .slice(0, 3)
    .map((s) => `$${s}$`);
}

export function writeTopicFile(
  topic: string,
  diff: Difficulty,
  problems: Problem[]
): void {
  const dir = path.join(process.cwd(), "content", "problems", GROUP);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${topic}.${diff}.json`);
  fs.writeFileSync(file, JSON.stringify(problems, null, 2));
  console.log(`Wrote ${problems.length} problems to ${file}`);
}
