import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

type Difficulty = "easy" | "medium" | "hard";
type AnswerType =
  | "integer"
  | "fraction"
  | "decimal"
  | "expression"
  | "ordered_pair"
  | "set"
  | "interval"
  | "boolean"
  | "string";

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
  answer_type: AnswerType;
  accepted_forms: string[];
  solution_latex: string;
  complexity_factor: number;
  source_section: string;
  tags: string[];
  checksum: string;
  status: "valid";
}

const GROUP_ID = "ch11_special_factorizations";
const OUT_DIR = path.join(process.cwd(), "content", "problems", GROUP_ID);

class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state ^= this.state << 13;
    this.state ^= this.state >>> 17;
    this.state ^= this.state << 5;
    return (this.state >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  shuffle<T>(items: T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

function checksum(problem: Partial<Problem>): string {
  const payload =
    (problem.topic_id ?? "") +
    (problem.difficulty ?? "") +
    (problem.prompt_latex ?? "") +
    (problem.correct_answer ?? "");
  return "sha256-" + crypto.createHash("sha256").update(payload).digest("hex");
}

function uniq(items: string[], correct: string): string[] {
  const seen = new Set<string>([correct.replace(/\s+/g, "")]);
  const out: string[] = [];
  for (const item of items) {
    const key = item.replace(/\s+/g, "");
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out.slice(0, 3);
}

function makeMC(correctLatex: string, distractors: string[], rng: Rng): { choices: Choice[]; correct_choice: string } {
  const clean = uniq(distractors, correctLatex);
  if (clean.length !== 3) {
    throw new Error(`Need 3 distinct distractors for ${correctLatex}`);
  }
  const rows = rng.shuffle([
    { latex: correctLatex, correct: true },
    ...clean.map((latex) => ({ latex, correct: false })),
  ]);
  const ids = ["a", "b", "c", "d"];
  const choices = rows.map((row, i) => ({ id: ids[i], latex: row.latex }));
  return { choices, correct_choice: choices[rows.findIndex((row) => row.correct)].id };
}

function makeProblem(
  index: number,
  topic: string,
  difficulty: Difficulty,
  source: string,
  prompt: string,
  correctLatex: string,
  correctAnswer: string,
  answerType: AnswerType,
  distractors: string[],
  solution: string,
  complexity: number,
  tags: string[],
  rng: Rng,
  acceptedForms: string[] = []
): Problem {
  const mc = makeMC(correctLatex, distractors, rng);
  const problem: Problem = {
    id: `${topic}.${difficulty}.${String(index).padStart(4, "0")}`,
    topic_id: topic,
    group_id: GROUP_ID,
    difficulty,
    prompt_latex: prompt,
    answer_format: "mc",
    choices: mc.choices,
    correct_choice: mc.correct_choice,
    correct_answer: correctAnswer,
    answer_type: answerType,
    accepted_forms: acceptedForms,
    solution_latex: solution,
    complexity_factor: complexity,
    source_section: source,
    tags,
    checksum: "",
    status: "valid",
  };
  problem.checksum = checksum(problem);
  return problem;
}

function wrap(s: string): string {
  return `$${s}$`;
}

function coeffLatex(c: number, variable: string): string {
  if (c === 1) return variable;
  if (c === -1) return `-${variable}`;
  return `${c}${variable}`;
}

function polyLatex(terms: { coef: number; body: string }[]): string {
  const parts: string[] = [];
  for (const term of terms) {
    if (term.coef === 0) continue;
    const abs = Math.abs(term.coef);
    const core = term.body === "" ? `${abs}` : abs === 1 ? term.body : `${abs}${term.body}`;
    if (parts.length === 0) {
      parts.push(term.coef < 0 ? `-${core}` : core);
    } else {
      parts.push(term.coef < 0 ? `- ${core}` : `+ ${core}`);
    }
  }
  return parts.join(" ") || "0";
}

function signedNumber(n: number): string {
  return n >= 0 ? `+ ${n}` : `- ${Math.abs(n)}`;
}

function linLatex(m: number, n: number, variable = "x"): string {
  const first = coeffLatex(m, variable);
  return `${first} ${signedNumber(n)}`;
}

function linPlain(m: number, n: number, variable = "x"): string {
  const first = m === 1 ? variable : m === -1 ? `-${variable}` : `${m}*${variable}`;
  return `${first}${n >= 0 ? "+" : ""}${n}`;
}

function squarePlain(m: number, n: number): string {
  return `(${linPlain(m, n)})^2`;
}

function quadPlain(a: number, b: number, c: number): string {
  return `${a}*x^2${b >= 0 ? "+" : ""}${b}*x${c >= 0 ? "+" : ""}${c}`;
}

function quadLatex(a: number, b: number, c: number): string {
  return polyLatex([
    { coef: a, body: "x^2" },
    { coef: b, body: "x" },
    { coef: c, body: "" },
  ]);
}

function cubeLatex(n: number): string {
  return `${n ** 3}`;
}

function divisors(n: number): number[] {
  const out: number[] = [];
  for (let d = 1; d * d <= n; d++) {
    if (n % d === 0) {
      out.push(d);
      if (d * d !== n) out.push(n / d);
    }
  }
  return out.sort((a, b) => a - b);
}

function sum(items: number[]): number {
  return items.reduce((acc, item) => acc + item, 0);
}

function intChoices(answer: number): string[] {
  const offsets = [1, -1, 2, -2, 3, -3, answer === 0 ? 4 : -answer];
  const out: string[] = [];
  for (const offset of offsets) {
    const value = answer + offset;
    if (value !== answer && !out.includes(wrap(String(value)))) out.push(wrap(String(value)));
    if (out.length === 3) break;
  }
  return out;
}

function generateSquares(difficulty: Difficulty, rng: Rng): Problem[] {
  const topic = "ch11.squares_binomials";
  const problems: Problem[] = [];
  let index = 1;
  const add = (...args: Parameters<typeof makeProblem> extends [number, ...infer R] ? R : never) => {
    problems.push(makeProblem(index++, ...args));
  };

  if (difficulty === "easy") {
    for (let i = 0; problems.length < 25; i++) {
      const a = 2 + i;
      const sign = i % 2 === 0 ? 1 : -1;
      const b = sign * 2 * a;
      const c = a * a;
      const factor = sign > 0 ? `(x + ${a})^2` : `(x - ${a})^2`;
      add(
        topic,
        difficulty,
        "11.1",
        `Expand: $${factor}$.`,
        wrap(quadLatex(1, b, c)),
        quadPlain(1, b, c),
        "expression",
        [
          wrap(quadLatex(1, 0, c)),
          wrap(quadLatex(1, sign * a, c)),
          wrap(quadLatex(1, -b, c)),
        ],
        `Use $(u ${sign > 0 ? "+" : "-"} v)^2=u^2 ${sign > 0 ? "+" : "-"} 2uv+v^2$ with $u=x$ and $v=${a}$.`,
        0.95,
        ["special-factorization", "square-of-binomial", "expansion"],
        rng,
        [factor.replace(/\s+/g, "")]
      );
    }
    for (let i = 0; problems.length < 50; i++) {
      const a = 2 + i;
      const sign = i % 2 === 0 ? 1 : -1;
      const b = sign * 2 * a;
      const c = a * a;
      const correct = sign > 0 ? `(x+${a})^2` : `(x-${a})^2`;
      const correctLatex = sign > 0 ? wrap(`(x + ${a})^2`) : wrap(`(x - ${a})^2`);
      add(
        topic,
        difficulty,
        "11.1",
        `Factor completely: $${quadLatex(1, b, c)}$.`,
        correctLatex,
        correct,
        "expression",
        [
          wrap(`(x ${sign > 0 ? "-" : "+"} ${a})^2`),
          wrap(`(x - ${a})(x + ${a})`),
          wrap(`(x ${sign > 0 ? "+" : "-"} ${2 * a})^2`),
        ],
        `Since $${c}=${a}^2$ and the middle term is $${b}x$, the trinomial is $${correctLatex.slice(1, -1)}$.`,
        0.95,
        ["special-factorization", "square-of-binomial", "factoring"],
        rng,
        [sign > 0 ? `(${a}+x)^2` : `(-${a}+x)^2`]
      );
    }
  } else if (difficulty === "medium") {
    for (let i = 0; problems.length < 30; i++) {
      const m = 2 + (i % 6);
      const n = 1 + ((i * 3) % 10);
      const sign = i % 2 === 0 ? 1 : -1;
      const a = m * m;
      const b = sign * 2 * m * n;
      const c = n * n;
      add(
        topic,
        difficulty,
        "11.1",
        `Expand: $(${linLatex(m, sign * n)})^2$.`,
        wrap(quadLatex(a, b, c)),
        quadPlain(a, b, c),
        "expression",
        [
          wrap(quadLatex(a, 0, c)),
          wrap(quadLatex(a, sign * m * n, c)),
          wrap(quadLatex(a, -b, c)),
        ],
        `Use $(a+b)^2=a^2+2ab+b^2$: the middle coefficient is $2\\cdot ${m}\\cdot ${sign * n}=${b}$.`,
        1.1,
        ["special-factorization", "square-of-binomial", "expansion"],
        rng,
        [squarePlain(m, sign * n)]
      );
    }
    for (let i = 0; problems.length < 50; i++) {
      const m = 2 + (i % 7);
      const n = 2 + ((i * 2) % 9);
      const sign = i % 2 === 0 ? 1 : -1;
      const k = sign * 2 * m * n;
      add(
        topic,
        difficulty,
        "11.1",
        `If $${m * m}x^2 + kx + ${n * n}=(${linLatex(m, sign * n)})^2$, what is $k$?`,
        wrap(String(k)),
        String(k),
        "integer",
        intChoices(k),
        `The middle term is $2\\cdot ${m}x\\cdot (${sign * n})=${k}x$, so $k=${k}$.`,
        1.1,
        ["special-factorization", "square-of-binomial", "missing-coefficient"],
        rng
      );
    }
  } else {
    for (let i = 0; problems.length < 25; i++) {
      const m = 2 + (i % 7);
      const n = 3 + ((i * 4) % 11);
      const sign = i % 2 === 0 ? 1 : -1;
      const correct = `(${m}*a${sign > 0 ? "+" : "-"}${n}*b)^2`;
      const correctLatex = sign > 0 ? wrap(`(${m}a + ${n}b)^2`) : wrap(`(${m}a - ${n}b)^2`);
      add(
        topic,
        difficulty,
        "11.1",
        `Factor completely: $${m * m}a^2 ${sign > 0 ? "+" : "-"} ${2 * m * n}ab + ${n * n}b^2$.`,
        correctLatex,
        correct,
        "expression",
        [
          sign > 0 ? wrap(`(${m}a - ${n}b)^2`) : wrap(`(${m}a + ${n}b)^2`),
          wrap(`(${m}a - ${n}b)(${m}a + ${n}b)`),
          sign > 0 ? wrap(`(${m}a + ${2 * n}b)^2`) : wrap(`(${m}a - ${2 * n}b)^2`),
        ],
        `Both end terms are squares and the middle term is twice the product, so the factorization is $${correctLatex.slice(1, -1)}$.`,
        1.3,
        ["special-factorization", "square-of-binomial", "two-variable"],
        rng,
        [sign > 0 ? `(${n}*b+${m}*a)^2` : `(${m}*a-${n}*b)^2`]
      );
    }
    for (let i = 0; problems.length < 50; i++) {
      const base = 40 + i;
      const offset = 2 + (i % 9);
      const value = base * base + 2 * base * offset + offset * offset;
      add(
        topic,
        difficulty,
        "11.1",
        `Evaluate mentally using a square identity: $${base}^2 + 2\\cdot ${base}\\cdot ${offset} + ${offset}^2$.`,
        wrap(String(value)),
        String(value),
        "integer",
        intChoices(value),
        `The expression is $(${base}+${offset})^2=${base + offset}^2=${value}$.`,
        1.25,
        ["special-factorization", "square-of-binomial", "mental-math"],
        rng
      );
    }
  }
  return problems;
}

function generateDifferenceSquares(difficulty: Difficulty, rng: Rng): Problem[] {
  const topic = "ch11.difference_squares";
  const problems: Problem[] = [];
  let index = 1;
  const add = (...args: Parameters<typeof makeProblem> extends [number, ...infer R] ? R : never) => problems.push(makeProblem(index++, ...args));

  if (difficulty === "easy") {
    for (let i = 0; problems.length < 35; i++) {
      const n = 2 + i;
      add(
        topic,
        difficulty,
        "11.2",
        `Factor completely: $x^2 - ${n * n}$.`,
        wrap(`(x - ${n})(x + ${n})`),
        `(x-${n})*(x+${n})`,
        "expression",
        [wrap(`(x - ${n})^2`), wrap(`(x + ${n})^2`), wrap(`(x - ${n * n})(x + 1)`)],
        `Use $a^2-b^2=(a-b)(a+b)$ with $a=x$ and $b=${n}$.`,
        0.95,
        ["special-factorization", "difference-of-squares", "factoring"],
        rng,
        [`(x+${n})*(x-${n})`]
      );
    }
    for (let i = 0; problems.length < 50; i++) {
      const a = 20 + i;
      const b = 1 + (i % 8);
      const value = a * a - b * b;
      add(
        topic,
        difficulty,
        "11.2",
        `Evaluate using difference of squares: $${a}^2 - ${b}^2$.`,
        wrap(String(value)),
        String(value),
        "integer",
        intChoices(value),
        `$${a}^2-${b}^2=(${a}-${b})(${a}+${b})=${a - b}\\cdot ${a + b}=${value}$.`,
        0.9,
        ["special-factorization", "difference-of-squares", "mental-math"],
        rng
      );
    }
  } else if (difficulty === "medium") {
    for (let i = 0; problems.length < 30; i++) {
      const m = 2 + (i % 9);
      const n = 3 + ((i * 2) % 11);
      add(
        topic,
        difficulty,
        "11.2",
        `Factor completely: $${m * m}x^2 - ${n * n}$.`,
        wrap(`(${m}x - ${n})(${m}x + ${n})`),
        `(${m}*x-${n})*(${m}*x+${n})`,
        "expression",
        [wrap(`(${m}x - ${n})^2`), wrap(`(${m}x + ${n})^2`), wrap(`(${m}x - ${n * n})(${m}x + 1)`) ],
        `This is $(${m}x)^2-${n}^2$, so it factors as $(${m}x-${n})(${m}x+${n})$.`,
        1.1,
        ["special-factorization", "difference-of-squares", "factoring"],
        rng,
        [`(${m}*x+${n})*(${m}*x-${n})`]
      );
    }
    for (let i = 0; problems.length < 50; i++) {
      const a = 1 + (i % 8);
      const b = 5 + ((i * 3) % 13);
      const c = 1 + (i % 5);
      const f1 = a - c;
      const f2 = a + c;
      add(
        topic,
        difficulty,
        "11.2",
        `Factor: $(x + ${a})^2 - ${c * c}$.`,
        wrap(`(x + ${f1})(x + ${f2})`),
        `(x+${f1})*(x+${f2})`,
        "expression",
        [wrap(`(x + ${a})^2`), wrap(`(x + ${a - c})^2`), wrap(`(x + ${a})(x - ${c})`)],
        `Let $u=x+${a}$. Then $u^2-${c}^2=(u-${c})(u+${c})=(x+${f1})(x+${f2})$.`,
        1.15,
        ["special-factorization", "difference-of-squares", "substitution"],
        rng,
        [`(x+${f2})*(x+${f1})`]
      );
      void b;
    }
  } else {
    for (let i = 0; problems.length < 25; i++) {
      const a = 2 + (i % 9);
      const b = 20 + i;
      const diff = a - b;
      const sumAB = a + b;
      add(
        topic,
        difficulty,
        "11.2",
        `Factor completely: $(x + ${a})^2 - (x + ${b})^2$.`,
        wrap(`${diff}(${polyLatex([{ coef: 2, body: "x" }, { coef: sumAB, body: "" }])})`),
        `${diff}*(2*x+${sumAB})`,
        "expression",
        [wrap(`(x + ${a} - x - ${b})^2`), wrap(`(x + ${a})(x + ${b})`), wrap(`${sumAB}(2x + ${diff})`)],
        `Use $A^2-B^2=(A-B)(A+B)$. Here $A-B=${diff}$ and $A+B=2x+${sumAB}$.`,
        1.3,
        ["special-factorization", "difference-of-squares", "substitution"],
        rng,
        [`(2*x+${sumAB})*${diff}`]
      );
    }
    for (let i = 0; problems.length < 50; i++) {
      const n = 20 + i;
      const target = 2 * n + 1;
      add(
        topic,
        difficulty,
        "11.2",
        `Find $x$ if $x^2 - ${n * n}=${target}$ and $x$ is positive.`,
        wrap(String(n + 1)),
        String(n + 1),
        "integer",
        intChoices(n + 1),
        `$x^2-${n}^2=(x-${n})(x+${n})=${target}$. Since $${target}=${n + 1 - n}\\cdot ${n + 1 + n}$, $x=${n + 1}$.`,
        1.35,
        ["special-factorization", "difference-of-squares", "equation"],
        rng
      );
    }
  }
  return problems;
}

function generateCubes(difficulty: Difficulty, rng: Rng): Problem[] {
  const topic = "ch11.sum_diff_cubes";
  const problems: Problem[] = [];
  let index = 1;
  const add = (...args: Parameters<typeof makeProblem> extends [number, ...infer R] ? R : never) => problems.push(makeProblem(index++, ...args));

  if (difficulty === "easy") {
    for (let i = 0; problems.length < 50; i++) {
      const n = 2 + i;
      const plus = i % 2 === 0;
      const prompt = plus ? `Factor completely: $x^3 + ${cubeLatex(n)}$.` : `Factor completely: $x^3 - ${cubeLatex(n)}$.`;
      const correctLatex = plus ? wrap(`(x + ${n})(x^2 - ${n}x + ${n * n})`) : wrap(`(x - ${n})(x^2 + ${n}x + ${n * n})`);
      const correct = plus ? `(x+${n})*(x^2-${n}*x+${n * n})` : `(x-${n})*(x^2+${n}*x+${n * n})`;
      add(
        topic,
        difficulty,
        "11.3",
        prompt,
        correctLatex,
        correct,
        "expression",
        plus
          ? [wrap(`(x + ${n})(x^2 + ${n}x + ${n * n})`), wrap(`(x - ${n})(x^2 + ${n}x + ${n * n})`), wrap(`(x + ${n})(x^2 - ${n * n})`)]
          : [wrap(`(x - ${n})(x^2 - ${n}x + ${n * n})`), wrap(`(x + ${n})(x^2 - ${n}x + ${n * n})`), wrap(`(x - ${n})(x^2 - ${n * n})`)],
        plus
          ? `Use $a^3+b^3=(a+b)(a^2-ab+b^2)$ with $a=x$ and $b=${n}$.`
          : `Use $a^3-b^3=(a-b)(a^2+ab+b^2)$ with $a=x$ and $b=${n}$.`,
        1.05,
        ["special-factorization", "sum-difference-cubes", "factoring"],
        rng,
        plus ? [`(x^2-${n}*x+${n * n})*(x+${n})`] : [`(x^2+${n}*x+${n * n})*(x-${n})`]
      );
    }
  } else if (difficulty === "medium") {
    for (let i = 0; problems.length < 30; i++) {
      const m = 2 + (i % 5);
      const n = 2 + ((i * 2) % 9);
      const plus = i % 2 === 0;
      const a = m ** 3;
      const c = n ** 3;
      const correctLatex = plus ? wrap(`(${m}x + ${n})(${m * m}x^2 - ${m * n}x + ${n * n})`) : wrap(`(${m}x - ${n})(${m * m}x^2 + ${m * n}x + ${n * n})`);
      const correct = plus ? `(${m}*x+${n})*(${m * m}*x^2-${m * n}*x+${n * n})` : `(${m}*x-${n})*(${m * m}*x^2+${m * n}*x+${n * n})`;
      add(
        topic,
        difficulty,
        "11.3",
        `Factor completely: $${a}x^3 ${plus ? "+" : "-"} ${c}$.`,
        correctLatex,
        correct,
        "expression",
        plus
          ? [wrap(`(${m}x + ${n})(${m * m}x^2 + ${m * n}x + ${n * n})`), wrap(`(${m}x - ${n})(${m * m}x^2 + ${m * n}x + ${n * n})`), wrap(`(${m}x + ${n})(${m * m}x^2 - ${n * n})`)]
          : [wrap(`(${m}x - ${n})(${m * m}x^2 - ${m * n}x + ${n * n})`), wrap(`(${m}x + ${n})(${m * m}x^2 - ${m * n}x + ${n * n})`), wrap(`(${m}x - ${n})(${m * m}x^2 - ${n * n})`)],
        `View the expression as $(${m}x)^3 ${plus ? "+" : "-"} ${n}^3$ and apply the cube identity.`,
        1.2,
        ["special-factorization", "sum-difference-cubes", "factoring"],
        rng,
        plus ? [`(${m * m}*x^2-${m * n}*x+${n * n})*(${m}*x+${n})`] : [`(${m * m}*x^2+${m * n}*x+${n * n})*(${m}*x-${n})`]
      );
    }
    for (let i = 0; problems.length < 50; i++) {
      const n = 2 + i;
      const plus = i % 2 === 0;
      add(
        topic,
        difficulty,
        "11.3",
        plus ? `Expand: $(x + ${n})(x^2 - ${n}x + ${n * n})$.` : `Expand: $(x - ${n})(x^2 + ${n}x + ${n * n})$.`,
        plus ? wrap(`x^3 + ${n ** 3}`) : wrap(`x^3 - ${n ** 3}`),
        plus ? `x^3+${n ** 3}` : `x^3-${n ** 3}`,
        "expression",
        plus
          ? [wrap(`x^3 - ${n ** 3}`), wrap(`x^3 + ${n}x + ${n ** 3}`), wrap(`x^3 + ${n * n}x + ${n ** 3}`)]
          : [wrap(`x^3 + ${n ** 3}`), wrap(`x^3 - ${n}x - ${n ** 3}`), wrap(`x^3 - ${n * n}x - ${n ** 3}`)],
        `The middle terms cancel, leaving ${plus ? `$x^3+${n}^3$` : `$x^3-${n}^3$`}.`,
        1.15,
        ["special-factorization", "sum-difference-cubes", "expansion"],
        rng
      );
    }
  } else {
    for (let i = 0; problems.length < 25; i++) {
      const g = 2 + (i % 7);
      const n = 2 + ((i * 3) % 10);
      const plus = i % 2 === 0;
      const correctLatex = plus ? wrap(`${g}(x + ${n})(x^2 - ${n}x + ${n * n})`) : wrap(`${g}(x - ${n})(x^2 + ${n}x + ${n * n})`);
      const correct = plus ? `${g}*(x+${n})*(x^2-${n}*x+${n * n})` : `${g}*(x-${n})*(x^2+${n}*x+${n * n})`;
      add(
        topic,
        difficulty,
        "11.3",
        `Factor completely: $${g}x^3 ${plus ? "+" : "-"} ${g * n ** 3}$.`,
        correctLatex,
        correct,
        "expression",
        plus
          ? [wrap(`${g}(x + ${n})(x^2 + ${n}x + ${n * n})`), wrap(`(x + ${n})(x^2 - ${n}x + ${n * n})`), wrap(`${g}(x - ${n})(x^2 + ${n}x + ${n * n})`)]
          : [wrap(`${g}(x - ${n})(x^2 - ${n}x + ${n * n})`), wrap(`(x - ${n})(x^2 + ${n}x + ${n * n})`), wrap(`${g}(x + ${n})(x^2 - ${n}x + ${n * n})`)],
        `First factor out $${g}$, then factor $x^3 ${plus ? "+" : "-"} ${n}^3$ using the cube identity.`,
        1.35,
        ["special-factorization", "sum-difference-cubes", "factoring"],
        rng
      );
    }
    for (let i = 0; problems.length < 50; i++) {
      const n = 2 + i;
      const plus = i % 2 === 0;
      const root = plus ? -n : n;
      add(
        topic,
        difficulty,
        "11.3",
        `Find the integer solution of $x^3 ${plus ? "+" : "-"} ${n ** 3}=0$.`,
        wrap(String(root)),
        String(root),
        "integer",
        intChoices(root),
        plus ? `$x^3=-${n}^3$, so $x=-${n}$.` : `$x^3=${n}^3$, so $x=${n}$.`,
        1.25,
        ["special-factorization", "sum-difference-cubes", "equation"],
        rng
      );
    }
  }
  return problems;
}

function sqrtLatex(n: number): string {
  return `\\sqrt{${n}}`;
}

function rationalizingAnswerLatex(num: string, den: number): string {
  return den === 1 ? num : `\\frac{${num}}{${den}}`;
}

function generateRationalizing(difficulty: Difficulty, rng: Rng): Problem[] {
  const topic = "ch11.rationalizing";
  const problems: Problem[] = [];
  let index = 1;
  const add = (...args: Parameters<typeof makeProblem> extends [number, ...infer R] ? R : never) => problems.push(makeProblem(index++, ...args));
  const nonsquares = [2, 3, 5, 6, 7, 10, 11, 13, 14, 15, 17, 19, 21, 22, 23, 26, 29, 30, 31, 33, 34, 35, 37, 38, 39];

  if (difficulty === "easy") {
    for (let i = 0; problems.length < 50; i++) {
      const n = nonsquares[i % nonsquares.length];
      const b = 1 + Math.floor(i / nonsquares.length);
      const numLatex = b === 1 ? sqrtLatex(n) : `${b}${sqrtLatex(n)}`;
      add(
        topic,
        difficulty,
        "11.4",
        `Rationalize the denominator: $\\frac{${b}}{\\sqrt{${n}}}$.`,
        wrap(rationalizingAnswerLatex(numLatex, n)),
        `${b}*sqrt(${n})/${n}`,
        "expression",
        [wrap(`${b}${sqrtLatex(n)}`), wrap(`\\frac{${b}}{${n}${sqrtLatex(n)}}`), wrap(`\\frac{${sqrtLatex(n)}}{${b}}`)],
        `Multiply numerator and denominator by $\\sqrt{${n}}$ to get $\\frac{${b}\\sqrt{${n}}}{${n}}$.`,
        1.05,
        ["special-factorization", "rationalizing", "radicals"],
        rng,
        [`(${b}*sqrt(${n}))/${n}`]
      );
    }
  } else if (difficulty === "medium") {
    for (let i = 0; problems.length < 25; i++) {
      const a = nonsquares[10 + (i % 15)];
      const b = nonsquares[(i * 7) % 10];
      const hi = Math.max(a, b);
      const lo = Math.min(a, b);
      const den = hi - lo;
      add(
        topic,
        difficulty,
        "11.4",
        `Rationalize the denominator: $\\frac{1}{\\sqrt{${hi}} + \\sqrt{${lo}}}$.`,
        wrap(rationalizingAnswerLatex(`${sqrtLatex(hi)} - ${sqrtLatex(lo)}`, den)),
        `(sqrt(${hi})-sqrt(${lo}))/${den}`,
        "expression",
        [
          wrap(rationalizingAnswerLatex(`${sqrtLatex(hi)} + ${sqrtLatex(lo)}`, den)),
          wrap(rationalizingAnswerLatex(`${sqrtLatex(lo)} - ${sqrtLatex(hi)}`, den)),
          wrap(rationalizingAnswerLatex(`${sqrtLatex(hi)} - ${sqrtLatex(lo)}`, hi + lo)),
        ],
        `Multiply by the conjugate. The denominator becomes $${hi}-${lo}=${den}$.`,
        1.25,
        ["special-factorization", "rationalizing", "conjugates"],
        rng
      );
    }
    for (let i = 0; problems.length < 50; i++) {
      const c = 1 + (i % 4);
      const n = [5, 7, 10, 13, 17, 19, 22, 26, 29, 31, 34, 37, 41, 43, 46, 47, 53, 55, 58, 59, 61, 62, 65, 67, 71][i % 25] + c * c;
      const a = 1 + (i % 3);
      const den = n - c * c;
      const numLatex = a === 1 ? `${sqrtLatex(n)} - ${c}` : `${a}(${sqrtLatex(n)} - ${c})`;
      add(
        topic,
        difficulty,
        "11.4",
        `Rationalize the denominator: $\\frac{${a}}{\\sqrt{${n}} + ${c}}$.`,
        wrap(rationalizingAnswerLatex(numLatex, den)),
        `${a}*(sqrt(${n})-${c})/${den}`,
        "expression",
        [
          wrap(rationalizingAnswerLatex(a === 1 ? `${sqrtLatex(n)} + ${c}` : `${a}(${sqrtLatex(n)} + ${c})`, den)),
          wrap(rationalizingAnswerLatex(numLatex, n + c * c)),
          wrap(`\\frac{${a}}{\\sqrt{${n}} - ${c}}`),
        ],
        `Multiply by $\\sqrt{${n}}-${c}$. The denominator is $${n}-${c * c}=${den}$.`,
        1.3,
        ["special-factorization", "rationalizing", "conjugates"],
        rng
      );
    }
  } else {
    const pairs = [
      [2, 3], [2, 5], [3, 5], [3, 7], [5, 7], [2, 11], [5, 11], [7, 11], [3, 13], [5, 13],
    ];
    for (let i = 0; problems.length < 50; i++) {
      const [a, b] = pairs[i % pairs.length];
      const p = 1 + (i % 4);
      const q = 3 + (i % 13);
      const den = q * q - b;
      const constTerm = p * q;
      const numLatex = `${constTerm} + ${p}${sqrtLatex(b)} + ${q}${sqrtLatex(a)} + ${sqrtLatex(a * b)}`;
      const correct = `(${constTerm}+${p}*sqrt(${b})+${q}*sqrt(${a})+sqrt(${a * b}))/${den}`;
      add(
        topic,
        difficulty,
        "11.4",
        `Rationalize the denominator: $\\frac{${p} + \\sqrt{${a}}}{${q} - \\sqrt{${b}}}$.`,
        wrap(rationalizingAnswerLatex(numLatex, den)),
        correct,
        "expression",
        [
          wrap(rationalizingAnswerLatex(`${constTerm} - ${p}${sqrtLatex(b)} + ${q}${sqrtLatex(a)} - ${sqrtLatex(a * b)}`, den)),
          wrap(rationalizingAnswerLatex(numLatex, q * q + b)),
          wrap(`\\frac{${p} + ${sqrtLatex(a)}}{${q} + ${sqrtLatex(b)}}`),
        ],
        `Multiply by the conjugate $${q}+\\sqrt{${b}}$. The denominator is $${q * q}-${b}=${den}$.`,
        1.45,
        ["special-factorization", "rationalizing", "conjugates"],
        rng
      );
    }
  }
  return problems;
}

function generateSfft(difficulty: Difficulty, rng: Rng): Problem[] {
  const topic = "ch11.sfft";
  const problems: Problem[] = [];
  let index = 1;
  const add = (...args: Parameters<typeof makeProblem> extends [number, ...infer R] ? R : never) => problems.push(makeProblem(index++, ...args));

  if (difficulty === "easy") {
    for (let i = 0; problems.length < 50; i++) {
      const a = 1 + (i % 9);
      const b = 2 + i;
      const constant = a * b;
      add(
        topic,
        difficulty,
        "11.5",
        `Factor using Simon's Favorite Factoring Trick: $xy + ${a}x + ${b}y + ${constant}$.`,
        wrap(`(x + ${b})(y + ${a})`),
        `(x+${b})*(y+${a})`,
        "expression",
        [wrap(`(x + ${a})(y + ${b})`), wrap(`(x - ${b})(y - ${a})`), wrap(`(x + ${b + 1})(y + ${a})`)],
        `The added constant is $${a}\\cdot ${b}=${constant}$, so $xy+${a}x+${b}y+${constant}=(x+${b})(y+${a})$.`,
        1.05,
        ["special-factorization", "sfft", "factoring"],
        rng,
        [`(y+${a})*(x+${b})`]
      );
    }
  } else if (difficulty === "medium") {
    for (let i = 0; problems.length < 25; i++) {
      const a = 1 + (i % 7);
      const b = 2 + ((i * 2) % 8);
      const n = [12, 18, 20, 24, 30, 36, 40, 42, 48, 54][i % 10];
      const c = n - a * b;
      const count = 2 * divisors(n).length;
      add(
        topic,
        difficulty,
        "11.5",
        `How many ordered integer pairs $(x,y)$ satisfy $xy + ${a}x + ${b}y = ${c}$?`,
        wrap(String(count)),
        String(count),
        "integer",
        intChoices(count),
        `Add $${a * b}$ to both sides: $(x+${b})(y+${a})=${n}$. Each positive or negative divisor of $${n}$ gives one ordered pair, so there are $${count}$ pairs.`,
        1.3,
        ["special-factorization", "sfft", "integer-solutions"],
        rng
      );
    }
    for (let i = 0; problems.length < 50; i++) {
      const a = 1 + (i % 8);
      const b = 1 + ((i * 3) % 8);
      const x = 2 + (i % 9);
      const y = 3 + ((i * 2) % 9);
      const c = x * y + a * x + b * y;
      add(
        topic,
        difficulty,
        "11.5",
        `If $xy + ${a}x + ${b}y = ${c}$ and $x=${x}$, what is $y$?`,
        wrap(String(y)),
        String(y),
        "integer",
        intChoices(y),
        `Substitute $x=${x}$: $${x}y+${a * x}+${b}y=${c}$, so $${x + b}y=${c - a * x}$ and $y=${y}$.`,
        1.2,
        ["special-factorization", "sfft", "equation"],
        rng
      );
    }
  } else {
    for (let i = 0; problems.length < 25; i++) {
      const n = [4, 6, 8, 9, 10, 12, 14, 15, 18, 20, 21, 22, 24, 25, 26, 27, 28, 30, 32, 33, 35, 36, 39, 40, 42][i % 25];
      const n2 = n * n;
      const count = divisors(n2).length;
      add(
        topic,
        difficulty,
        "11.5",
        `How many ordered positive integer pairs $(x,y)$ satisfy $\\frac{1}{x}+\\frac{1}{y}=\\frac{1}{${n}}$?`,
        wrap(String(count)),
        String(count),
        "integer",
        intChoices(count),
        `Multiplying by $${n}xy$ gives $${n}x+${n}y=xy$, or $(x-${n})(y-${n})=${n2}$. Positive divisors of $${n2}$ give $${count}$ ordered positive pairs.`,
        1.45,
        ["special-factorization", "sfft", "reciprocal-equation"],
        rng
      );
    }
    for (let i = 0; problems.length < 50; i++) {
      const n = [4, 5, 6, 8, 9, 10, 12, 15, 18, 20, 21, 22, 24, 25, 27, 28, 30, 32, 33, 35, 36, 39, 40, 42, 45][i % 25];
      const n2 = n * n;
      const ds = divisors(n2);
      const value = 2 * n * ds.length + 2 * sum(ds);
      add(
        topic,
        difficulty,
        "11.5",
        `For all ordered positive integer pairs $(x,y)$ satisfying $\\frac{1}{x}+\\frac{1}{y}=\\frac{1}{${n}}$, find the sum of all values of $x+y$.`,
        wrap(String(value)),
        String(value),
        "integer",
        intChoices(value),
        `Write $(x-${n})(y-${n})=${n2}$. For each divisor $d$ of $${n2}$, $x+y=2\\cdot ${n}+d+${n2}/d$. Summing over all divisors gives $${value}$.`,
        1.55,
        ["special-factorization", "sfft", "reciprocal-equation"],
        rng
      );
    }
  }
  return problems;
}

const generators: Record<string, (difficulty: Difficulty, rng: Rng) => Problem[]> = {
  "ch11.squares_binomials": generateSquares,
  "ch11.difference_squares": generateDifferenceSquares,
  "ch11.sum_diff_cubes": generateCubes,
  "ch11.rationalizing": generateRationalizing,
  "ch11.sfft": generateSfft,
};

const difficulties: Difficulty[] = ["easy", "medium", "hard"];

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const [topic, generator] of Object.entries(generators)) {
  for (const difficulty of difficulties) {
    const seed = Number.parseInt(crypto.createHash("sha256").update(`${topic}.${difficulty}`).digest("hex").slice(0, 8), 16);
    const rng = new Rng(seed);
    const problems = generator(difficulty, rng);
    if (problems.length !== 50) {
      throw new Error(`${topic}.${difficulty} generated ${problems.length} problems`);
    }
    const checks = new Set(problems.map((problem) => problem.checksum));
    if (checks.size !== problems.length) {
      throw new Error(`${topic}.${difficulty} has duplicate checksums`);
    }
    const file = path.join(OUT_DIR, `${topic}.${difficulty}.json`);
    fs.writeFileSync(file, JSON.stringify(problems, null, 2) + "\n");
  }
}

console.log("Generated Chapter 11 special factorization problems.");
