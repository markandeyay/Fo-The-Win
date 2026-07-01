import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { answersEquivalent, normalizeAnswer } from "../../lib/normalizeAnswer";

interface Choice {
  id: string;
  latex: string;
}

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

interface ProblemTemplate {
  topic_id: string;
  group_id: string;
  difficulty: Difficulty;
  prompt_latex: string;
  answer_format: "mc" | "numeric" | "exact";
  choices: Choice[];
  correct_choice: string;
  correct_answer: string;
  answer_type: AnswerType;
  accepted_forms?: string[];
  solution_latex: string;
  complexity_factor: number;
  source_section: string;
  tags: string[];
}

function computeChecksum(problem: Partial<ProblemTemplate>): string {
  const payload =
    (problem.topic_id ?? "") +
    (problem.difficulty ?? "") +
    (problem.prompt_latex ?? "") +
    (problem.correct_answer ?? "");
  return "sha256-" + crypto.createHash("sha256").update(payload).digest("hex");
}

function makeId(template: ProblemTemplate, index: number): string {
  return `${template.topic_id}.${template.difficulty}.${String(index).padStart(4, "0")}`;
}

function shuffleChoices(choices: Choice[], correctId: string): { choices: Choice[]; correctChoice: string } {
  const arr = [...choices];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const newChoices = arr.map((c, i) => ({ id: ["a", "b", "c", "d"][i], latex: c.latex }));
  const correctIndex = arr.findIndex((c) => c.id === correctId);
  return { choices: newChoices, correctChoice: ["a", "b", "c", "d"][correctIndex] };
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

function frac(n: number, d: number): string {
  const g = gcd(n, d);
  return `${n / g}/${d / g}`;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------- ch2.expressions ----------

function generateExpressionsEasy(): ProblemTemplate {
  const templates: (() => ProblemTemplate)[] = [
    () => {
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const x = randInt(2, 9);
      const ans = a * x + b;
      return {
        topic_id: "ch2.expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "easy",
        prompt_latex: `Evaluate $${a}x + ${b}$ when $x = ${x}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a * x + b + 1}$` },
          { id: "c", latex: `$${a + x + b}$` },
          { id: "d", latex: `$${a * (x + b)}$` },
        ],
        correct_choice: "a",
        correct_answer: String(ans),
        answer_type: "integer",
        solution_latex: `Substitute $x = ${x}$: $${a} \\cdot ${x} + ${b} = ${a * x} + ${b} = ${ans}$.`,
        complexity_factor: 0.7,
        source_section: "2.1",
        tags: ["expressions", "evaluation"],
      };
    },
    () => {
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const x = randInt(2, 9);
      const ans = a * x - b;
      return {
        topic_id: "ch2.expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "easy",
        prompt_latex: `Evaluate $${a}x - ${b}$ when $x = ${x}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a * x + b}$` },
          { id: "c", latex: `$${a + x - b}$` },
          { id: "d", latex: `$${a * (x - b)}$` },
        ],
        correct_choice: "a",
        correct_answer: String(ans),
        answer_type: "integer",
        solution_latex: `Substitute $x = ${x}$: $${a} \\cdot ${x} - ${b} = ${a * x} - ${b} = ${ans}$.`,
        complexity_factor: 0.7,
        source_section: "2.1",
        tags: ["expressions", "evaluation"],
      };
    },
    () => {
      const c = randInt(2, 9);
      const x = randInt(2, 9);
      const ans = x + c;
      return {
        topic_id: "ch2.expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "easy",
        prompt_latex: `Evaluate $x + ${c}$ when $x = ${x}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${x * c}$` },
          { id: "c", latex: `$${x - c}$` },
          { id: "d", latex: `$${c - x}$` },
        ],
        correct_choice: "a",
        correct_answer: String(ans),
        answer_type: "integer",
        solution_latex: `Substitute $x = ${x}$: $${x} + ${c} = ${ans}$.`,
        complexity_factor: 0.7,
        source_section: "2.1",
        tags: ["expressions", "evaluation"],
      };
    },
    () => {
      const c = randInt(2, 9);
      const x = randInt(2, 9);
      const ans = x - c;
      return {
        topic_id: "ch2.expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "easy",
        prompt_latex: `Evaluate $x - ${c}$ when $x = ${x}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${x + c}$` },
          { id: "c", latex: `$${c - x}$` },
          { id: "d", latex: `$${x * c}$` },
        ],
        correct_choice: "a",
        correct_answer: String(ans),
        answer_type: "integer",
        solution_latex: `Substitute $x = ${x}$: $${x} - ${c} = ${ans}$.`,
        complexity_factor: 0.7,
        source_section: "2.1",
        tags: ["expressions", "evaluation"],
      };
    },
    () => {
      const a = randInt(2, 9);
      const x = randInt(2, 9);
      const ans = a * x;
      return {
        topic_id: "ch2.expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "easy",
        prompt_latex: `Evaluate $${a}x$ when $x = ${x}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a + x}$` },
          { id: "c", latex: `$${a - x}$` },
          { id: "d", latex: `$${x - a}$` },
        ],
        correct_choice: "a",
        correct_answer: String(ans),
        answer_type: "integer",
        solution_latex: `Substitute $x = ${x}$: $${a} \\cdot ${x} = ${ans}$.`,
        complexity_factor: 0.7,
        source_section: "2.1",
        tags: ["expressions", "evaluation"],
      };
    },
    () => {
      const varName = pick(["a", "b", "c", "n"]);
      const coeff = randInt(2, 9);
      return {
        topic_id: "ch2.expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "easy",
        prompt_latex: `In the expression $${coeff}${varName}$, what is the coefficient of $${varName}$?`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${coeff}$` },
          { id: "b", latex: `$${coeff + 1}$` },
          { id: "c", latex: `$1$` },
          { id: "d", latex: `$0$` },
        ],
        correct_choice: "a",
        correct_answer: String(coeff),
        answer_type: "integer",
        solution_latex: `The coefficient is the numerical factor multiplying $${varName}$, which is $${coeff}$.`,
        complexity_factor: 0.7,
        source_section: "2.1",
        tags: ["expressions", "coefficient"],
      };
    },
    () => {
      const varName = pick(["x", "y", "z"]);
      const constTerm = randInt(2, 9);
      return {
        topic_id: "ch2.expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "easy",
        prompt_latex: `In the expression $${varName} + ${constTerm}$, what is the constant term?`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${constTerm}$` },
          { id: "b", latex: `$1$` },
          { id: "c", latex: `$${constTerm + 1}$` },
          { id: "d", latex: `$0$` },
        ],
        correct_choice: "a",
        correct_answer: String(constTerm),
        answer_type: "integer",
        solution_latex: `The constant term is the term without $${varName}$, which is $${constTerm}$.`,
        complexity_factor: 0.7,
        source_section: "2.1",
        tags: ["expressions", "constant_term"],
      };
    },
    () => {
      const ops = [
        { phrase: "the sum of $x$ and $5$", expr: "x+5" },
        { phrase: "$3$ more than $x$", expr: "x+3" },
        { phrase: "$7$ less than $x$", expr: "x-7" },
        { phrase: "the product of $4$ and $x$", expr: "4x" },
        { phrase: "$x$ decreased by $2$", expr: "x-2" },
      ];
      const selected = pick(ops);
      const distractors = ops.filter((o) => o.expr !== selected.expr).slice(0, 3);
      return {
        topic_id: "ch2.expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "easy",
        prompt_latex: `Which expression represents ${selected.phrase}?`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${selected.expr}$` },
          ...distractors.map((d, i) => ({ id: ["b", "c", "d"][i], latex: `$${d.expr}$` })),
        ],
        correct_choice: "a",
        correct_answer: selected.expr,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `${selected.phrase} translates to $${selected.expr}$.`,
        complexity_factor: 0.7,
        source_section: "2.1",
        tags: ["expressions", "translation"],
      };
    },
  ];
  return pick(templates)();
}

function generateExpressionsMedium(): ProblemTemplate {
  const templates: (() => ProblemTemplate)[] = [
    () => {
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const c = randInt(2, 9);
      const x = randInt(2, 9);
      const ans = a * x + b * x - c;
      return {
        topic_id: "ch2.expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "medium",
        prompt_latex: `Evaluate $${a}x + ${b}x - ${c}$ when $x = ${x}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a * x + b * x + c}$` },
          { id: "c", latex: `$${(a + b) * x - c + 1}$` },
          { id: "d", latex: `$${a * x * b * x - c}$` },
        ],
        correct_choice: "a",
        correct_answer: String(ans),
        answer_type: "integer",
        solution_latex: `Substitute: $${a} \\cdot ${x} + ${b} \\cdot ${x} - ${c} = ${a * x} + ${b * x} - ${c} = ${ans}$.`,
        complexity_factor: 0.8,
        source_section: "2.1",
        tags: ["expressions", "evaluation"],
      };
    },
    () => {
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const x = randInt(-5, -2);
      const ans = a * x + b;
      return {
        topic_id: "ch2.expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "medium",
        prompt_latex: `Evaluate $${a}x + ${b}$ when $x = ${x}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a * (-x) + b}$` },
          { id: "c", latex: `$${a + x + b}$` },
          { id: "d", latex: `$${a * x - b}$` },
        ],
        correct_choice: "a",
        correct_answer: String(ans),
        answer_type: "integer",
        solution_latex: `Substitute $x = ${x}$: $${a} \\cdot (${x}) + ${b} = ${a * x} + ${b} = ${ans}$.`,
        complexity_factor: 0.8,
        source_section: "2.1",
        tags: ["expressions", "evaluation", "negative"],
      };
    },
    () => {
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const c = randInt(2, 9);
      const x = randInt(2, 9);
      const ans = a * (x + b) - c;
      return {
        topic_id: "ch2.expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "medium",
        prompt_latex: `Evaluate $${a}(x + ${b}) - ${c}$ when $x = ${x}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a * x + b - c}$` },
          { id: "c", latex: `$${a * (x + b + c)}$` },
          { id: "d", latex: `$${a * x + a * b + c}$` },
        ],
        correct_choice: "a",
        correct_answer: String(ans),
        answer_type: "integer",
        solution_latex: `Inside parentheses: $${x} + ${b} = ${x + b}$. Multiply: $${a} \\cdot ${x + b} = ${a * (x + b)}$. Subtract ${c}: $${a * (x + b) - c} = ${ans}$.`,
        complexity_factor: 0.8,
        source_section: "2.1",
        tags: ["expressions", "evaluation"],
      };
    },
    () => {
      const x = randInt(2, 9);
      const y = randInt(2, 9);
      const a = randInt(2, 5);
      const b = randInt(2, 5);
      const ans = a * x + b * y;
      return {
        topic_id: "ch2.expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "medium",
        prompt_latex: `Evaluate $${a}x + ${b}y$ when $x = ${x}$ and $y = ${y}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a * x * b * y}$` },
          { id: "c", latex: `$${a * x + b + y}$` },
          { id: "d", latex: `$${(a + b) * (x + y)}$` },
        ],
        correct_choice: "a",
        correct_answer: String(ans),
        answer_type: "integer",
        solution_latex: `Substitute: $${a} \\cdot ${x} + ${b} \\cdot ${y} = ${a * x} + ${b * y} = ${ans}$.`,
        complexity_factor: 0.8,
        source_section: "2.1",
        tags: ["expressions", "evaluation", "multivariable"],
      };
    },
    () => {
      const base = randInt(2, 9);
      const height = randInt(2, 9);
      const ans = base * height;
      return {
        topic_id: "ch2.expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "medium",
        prompt_latex: `The area of a rectangle is given by $A = bh$. Find $A$ when $b = ${base}$ and $h = ${height}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${2 * (base + height)}$` },
          { id: "c", latex: `$${base + height}$` },
          { id: "d", latex: `$${base * height + 1}$` },
        ],
        correct_choice: "a",
        correct_answer: String(ans),
        answer_type: "integer",
        solution_latex: `$A = bh = ${base} \\cdot ${height} = ${ans}$.`,
        complexity_factor: 0.8,
        source_section: "2.1",
        tags: ["expressions", "formula"],
      };
    },
  ];
  return pick(templates)();
}

function generateExpressionsHard(): ProblemTemplate {
  const templates: (() => ProblemTemplate)[] = [
    () => {
      const a = randInt(2, 6);
      const b = randInt(2, 6);
      const c = randInt(2, 6);
      const x = randInt(-5, -2);
      const y = randInt(2, 5);
      const ans = a * x + b * y - c;
      return {
        topic_id: "ch2.expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "hard",
        prompt_latex: `Evaluate $${a}x + ${b}y - ${c}$ when $x = ${x}$ and $y = ${y}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a * x - b * y - c}$` },
          { id: "c", latex: `$${a * (-x) + b * y - c}$` },
          { id: "d", latex: `$${a * x + b * y + c}$` },
        ],
        correct_choice: "a",
        correct_answer: String(ans),
        answer_type: "integer",
        solution_latex: `Substitute: $${a}(${x}) + ${b}(${y}) - ${c} = ${a * x} + ${b * y} - ${c} = ${ans}$.`,
        complexity_factor: 0.9,
        source_section: "2.1",
        tags: ["expressions", "evaluation", "negative"],
      };
    },
    () => {
      const a = randInt(2, 6);
      const b = randInt(2, 6);
      const c = randInt(2, 6);
      const d = randInt(2, 6);
      const x = randInt(2, 5);
      const ansNum = a * x + b;
      const ansDen = c * x + d;
      const simplifiedNum = ansNum / gcd(ansNum, ansDen);
      const simplifiedDen = ansDen / gcd(ansNum, ansDen);
      const finalAns = frac(ansNum, ansDen);
      return {
        topic_id: "ch2.expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "hard",
        prompt_latex: `Evaluate $\\dfrac{${a}x + ${b}}{${c}x + ${d}}$ when $x = ${x}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$\\dfrac{${simplifiedNum}}{${simplifiedDen}}$` },
          { id: "b", latex: `$\\dfrac{${ansNum + 1}}{${ansDen}}$` },
          { id: "c", latex: `$\\dfrac{${ansNum}}{${ansDen - 1}}$` },
          { id: "d", latex: `$\\dfrac{${a + b}}{${c + d}}$` },
        ],
        correct_choice: "a",
        correct_answer: finalAns,
        answer_type: "fraction",
        solution_latex: `Substitute: numerator is $${a} \\cdot ${x} + ${b} = ${ansNum}$, denominator is $${c} \\cdot ${x} + ${d} = ${ansDen}$. Reduce to $\\dfrac{${simplifiedNum}}{${simplifiedDen}}$.`,
        complexity_factor: 0.9,
        source_section: "2.1",
        tags: ["expressions", "evaluation", "fraction"],
      };
    },
    () => {
      const price = randInt(5, 15);
      const taxRate = randInt(5, 15);
      const total = price * (100 + taxRate) / 100;
      const totalCents = Math.round(total * 100);
      const dollars = Math.floor(totalCents / 100);
      const cents = totalCents % 100;
      const displayTotal = cents === 0 ? `$${dollars}` : `$${dollars}.${String(cents).padStart(2, "0")}`;
      return {
        topic_id: "ch2.expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "hard",
        prompt_latex: `A shirt costs $\\$${price}$ and sales tax is $${taxRate}\\%$. Using $T = p(1 + r)$, what is the total cost in dollars?`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${displayTotal}$` },
          { id: "b", latex: `$${(price * taxRate / 100).toFixed(2)}$` },
          { id: "c", latex: `$${(price + taxRate).toFixed(2)}$` },
          { id: "d", latex: `$${(price * (1 + taxRate / 100) + 1).toFixed(2)}$` },
        ],
        correct_choice: "a",
        correct_answer: String(total),
        answer_type: "decimal",
        solution_latex: `$T = ${price}(1 + ${taxRate / 100}) = ${price} \\cdot ${(1 + taxRate / 100).toFixed(2)} = ${displayTotal}$.`,
        complexity_factor: 0.9,
        source_section: "2.1",
        tags: ["expressions", "formula", "percent"],
      };
    },
    () => {
      const m1 = randInt(2, 5);
      const m2 = randInt(2, 5);
      const distance = randInt(10, 30);
      const time = randInt(2, 5);
      const ans = m1 * distance / time + m2;
      return {
        topic_id: "ch2.expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "hard",
        prompt_latex: `A car travels $${distance}$ miles in $${time}$ hours, then speeds up by $${m2}$ mph. Its new speed is $\\dfrac{${m1}d}{t} + ${m2}$. Find the new speed.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${m1 * distance + m2}$` },
          { id: "c", latex: `$${distance / time + m2}$` },
          { id: "d", latex: `$${m1 * (distance + m2) / time}$` },
        ],
        correct_choice: "a",
        correct_answer: String(ans),
        answer_type: "integer",
        solution_latex: `Substitute $d = ${distance}$ and $t = ${time}$: $\\dfrac{${m1} \\cdot ${distance}}{${time}} + ${m2} = ${m1 * distance / time} + ${m2} = ${ans}$.`,
        complexity_factor: 0.9,
        source_section: "2.1",
        tags: ["expressions", "formula", "rate"],
      };
    },
  ];
  return pick(templates)();
}

// ---------- ch2.arithmetic_expressions ----------

function generateArithmeticEasy(): ProblemTemplate {
  const templates: (() => ProblemTemplate)[] = [
    () => {
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const varName = pick(["x", "y", "z"]);
      const ans = `${a + b}${varName}`;
      return {
        topic_id: "ch2.arithmetic_expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "easy",
        prompt_latex: `Simplify $${a}${varName} + ${b}${varName}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a * b}${varName}$` },
          { id: "c", latex: `$${a + b}${varName}^2$` },
          { id: "d", latex: `$${a + b + 1}${varName}$` },
        ],
        correct_choice: "a",
        correct_answer: ans,
        answer_type: "expression",
        accepted_forms: [`${a + b}*${varName}`],
        solution_latex: `Add the coefficients: $${a}${varName} + ${b}${varName} = (${a} + ${b})${varName} = ${ans}$.`,
        complexity_factor: 0.7,
        source_section: "2.2",
        tags: ["arithmetic_expressions", "like_terms"],
      };
    },
    () => {
      const a = randInt(5, 12);
      const b = randInt(2, 5);
      const varName = pick(["x", "y", "z"]);
      const ans = `${a - b}${varName}`;
      return {
        topic_id: "ch2.arithmetic_expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "easy",
        prompt_latex: `Simplify $${a}${varName} - ${b}${varName}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a + b}${varName}$` },
          { id: "c", latex: `$${a - b - 1}${varName}$` },
          { id: "d", latex: `$${a * b}${varName}$` },
        ],
        correct_choice: "a",
        correct_answer: ans,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `Subtract the coefficients: $${a}${varName} - ${b}${varName} = (${a} - ${b})${varName} = ${ans}$.`,
        complexity_factor: 0.7,
        source_section: "2.2",
        tags: ["arithmetic_expressions", "like_terms"],
      };
    },
    () => {
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const c = randInt(2, 9);
      const varName = pick(["x", "y"]);
      const ans = `${a + b}${varName} + ${c}`;
      return {
        topic_id: "ch2.arithmetic_expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "easy",
        prompt_latex: `Simplify $${a}${varName} + ${b}${varName} + ${c}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a + b + c}${varName}$` },
          { id: "c", latex: `$${(a + b) * c}${varName}$` },
          { id: "d", latex: `$${a + b}${varName} - ${c}$` },
        ],
        correct_choice: "a",
        correct_answer: ans,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `Combine like terms: $${a}${varName} + ${b}${varName} = ${a + b}${varName}$, so the expression is $${ans}$.`,
        complexity_factor: 0.7,
        source_section: "2.2",
        tags: ["arithmetic_expressions", "like_terms"],
      };
    },
    () => {
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const varName = pick(["x", "y"]);
      const ans = `${a * b}${varName}`;
      return {
        topic_id: "ch2.arithmetic_expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "easy",
        prompt_latex: `Simplify $${a}(${b}${varName})$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a + b}${varName}$` },
          { id: "c", latex: `$${a}${varName} + ${b}$` },
          { id: "d", latex: `$${a * b}${varName}^2$` },
        ],
        correct_choice: "a",
        correct_answer: ans,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `Multiply the coefficients: $${a} \\cdot ${b}${varName} = ${ans}$.`,
        complexity_factor: 0.7,
        source_section: "2.2",
        tags: ["arithmetic_expressions", "multiplication"],
      };
    },
    () => {
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const varName = pick(["x", "y"]);
      return {
        topic_id: "ch2.arithmetic_expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "easy",
        prompt_latex: `Which expression is equivalent to $${a}${varName} + ${b} + ${b}${varName}$?`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${a + b}${varName} + ${b}$` },
          { id: "b", latex: `$${a + b + b}${varName}$` },
          { id: "c", latex: `$${a + b}${varName}^2 + ${b}$` },
          { id: "d", latex: `$${a}${varName} + ${b}${varName}$` },
        ],
        correct_choice: "a",
        correct_answer: `${a + b}${varName} + ${b}`,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `Combine like terms: $${a}${varName} + ${b}${varName} = ${a + b}${varName}$, so the result is $${a + b}${varName} + ${b}$.`,
        complexity_factor: 0.7,
        source_section: "2.2",
        tags: ["arithmetic_expressions", "like_terms"],
      };
    },
  ];
  return pick(templates)();
}

function generateArithmeticMedium(): ProblemTemplate {
  const templates: (() => ProblemTemplate)[] = [
    () => {
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const c = randInt(2, 9);
      const d = randInt(2, 9);
      const varName = pick(["x", "y"]);
      const ans = `${a + c}${varName} + ${b + d}`;
      return {
        topic_id: "ch2.arithmetic_expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "medium",
        prompt_latex: `Simplify $(${a}${varName} + ${b}) + (${c}${varName} + ${d})$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a + c}${varName} + ${b + d + 1}$` },
          { id: "c", latex: `$${a * c}${varName}^2 + ${b * d}$` },
          { id: "d", latex: `$${a + b + c + d}${varName}$` },
        ],
        correct_choice: "a",
        correct_answer: ans,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `Group like terms: $(${a} + ${c})${varName} + (${b} + ${d}) = ${ans}$.`,
        complexity_factor: 0.8,
        source_section: "2.2",
        tags: ["arithmetic_expressions", "addition"],
      };
    },
    () => {
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const c = randInt(2, 9);
      const d = randInt(2, 9);
      const varName = pick(["x", "y"]);
      const ans = `${a - c}${varName} + ${b - d}`;
      return {
        topic_id: "ch2.arithmetic_expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "medium",
        prompt_latex: `Simplify $(${a}${varName} + ${b}) - (${c}${varName} + ${d})$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a + c}${varName} + ${b + d}$` },
          { id: "c", latex: `$${a - c}${varName} - ${b - d}$` },
          { id: "d", latex: `$${a * c}${varName}^2 - ${b * d}$` },
        ],
        correct_choice: "a",
        correct_answer: ans,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `Distribute the minus sign: $${a}${varName} + ${b} - ${c}${varName} - ${d} = ${ans}$.`,
        complexity_factor: 0.8,
        source_section: "2.2",
        tags: ["arithmetic_expressions", "subtraction"],
      };
    },
    () => {
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const c = randInt(2, 9);
      const d = randInt(2, 9);
      const varName = pick(["x", "y"]);
      const ans = `${a * c}${varName} + ${a * d + b}`;
      return {
        topic_id: "ch2.arithmetic_expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "medium",
        prompt_latex: `Simplify $${a}(${c}${varName} + ${d}) + ${b}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a * c}${varName} + ${a * d} + ${b}$` },
          { id: "c", latex: `$${a + c}${varName} + ${d + b}$` },
          { id: "d", latex: `$${a * c}${varName}^2 + ${a * d + b}$` },
        ],
        correct_choice: "a",
        correct_answer: ans,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `Distribute: $${a} \\cdot ${c}${varName} + ${a} \\cdot ${d} + ${b} = ${a * c}${varName} + ${a * d + b}$.`,
        complexity_factor: 0.8,
        source_section: "2.2",
        tags: ["arithmetic_expressions", "distribution"],
      };
    },
    () => {
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const c = randInt(2, 9);
      const d = randInt(2, 9);
      const varName = pick(["x", "y"]);
      const ans = `${a * c}${varName} + ${a * d - b}`;
      return {
        topic_id: "ch2.arithmetic_expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "medium",
        prompt_latex: `Simplify $${a}(${c}${varName} + ${d}) - ${b}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a * c}${varName} + ${a * d + b}$` },
          { id: "c", latex: `$${a + c}${varName} + ${d - b}$` },
          { id: "d", latex: `$${a * c}${varName}^2 - ${b}$` },
        ],
        correct_choice: "a",
        correct_answer: ans,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `Distribute: $${a} \\cdot ${c}${varName} + ${a} \\cdot ${d} - ${b} = ${ans}$.`,
        complexity_factor: 0.8,
        source_section: "2.2",
        tags: ["arithmetic_expressions", "distribution"],
      };
    },
    () => {
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const c = randInt(2, 9);
      const varName = pick(["x", "y"]);
      const ans = `${a + c}${varName} + ${b}`;
      return {
        topic_id: "ch2.arithmetic_expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "medium",
        prompt_latex: `Simplify $(${a}${varName} + ${b}) + ${c}${varName}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a + b + c}${varName}$` },
          { id: "c", latex: `$${a + c}${varName} + ${b + c}$` },
          { id: "d", latex: `$${a * c}${varName}^2 + ${b}$` },
        ],
        correct_choice: "a",
        correct_answer: ans,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `Combine like terms: $(${a} + ${c})${varName} + ${b} = ${ans}$.`,
        complexity_factor: 0.8,
        source_section: "2.2",
        tags: ["arithmetic_expressions", "like_terms"],
      };
    },
  ];
  return pick(templates)();
}

function generateArithmeticHard(): ProblemTemplate {
  const templates: (() => ProblemTemplate)[] = [
    () => {
      const a = randInt(2, 6);
      const b = randInt(2, 6);
      const c = randInt(2, 6);
      const d = randInt(2, 6);
      const e = randInt(2, 6);
      const varName = pick(["x", "y"]);
      const ans = `${a * c + e}${varName} + ${a * d - b}`;
      return {
        topic_id: "ch2.arithmetic_expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "hard",
        prompt_latex: `Simplify $${a}(${c}${varName} + ${d}) - ${b} + ${e}${varName}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a * c + e}${varName} + ${a * d + b}$` },
          { id: "c", latex: `$${a * c}${varName} + ${a * d - b + e}${varName}$` },
          { id: "d", latex: `$${a * c + e}${varName}^2 + ${a * d - b}$` },
        ],
        correct_choice: "a",
        correct_answer: ans,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `Distribute and combine: $${a * c}${varName} + ${a * d} - ${b} + ${e}${varName} = ${ans}$.`,
        complexity_factor: 0.9,
        source_section: "2.2",
        tags: ["arithmetic_expressions", "distribution", "like_terms"],
      };
    },
    () => {
      const a = randInt(2, 6);
      const b = randInt(2, 6);
      const c = randInt(2, 6);
      const d = randInt(2, 6);
      const varName = pick(["x", "y"]);
      const ans = `${a * c - 1}${varName} + ${a * d + b}`;
      return {
        topic_id: "ch2.arithmetic_expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "hard",
        prompt_latex: `Simplify $${a}(${c}${varName} + ${d}) + ${b} - ${varName}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a * c}${varName} + ${a * d + b - 1}$` },
          { id: "c", latex: `$${a * c - 1}${varName} + ${a * d + b + 1}$` },
          { id: "d", latex: `$${a * c}${varName}^2 + ${a * d + b} - ${varName}$` },
        ],
        correct_choice: "a",
        correct_answer: ans,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `Distribute: $${a * c}${varName} + ${a * d} + ${b} - ${varName} = ${ans}$.`,
        complexity_factor: 0.9,
        source_section: "2.2",
        tags: ["arithmetic_expressions", "distribution", "like_terms"],
      };
    },
    () => {
      const a = randInt(2, 6);
      const b = randInt(2, 6);
      const c = randInt(2, 6);
      const varName = pick(["x", "y"]);
      const ans = `${a * b * c}${varName}`;
      return {
        topic_id: "ch2.arithmetic_expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "hard",
        prompt_latex: `Simplify $${a}(${b}(${c}${varName}))$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a + b + c}${varName}$` },
          { id: "c", latex: `$${a * b + c}${varName}$` },
          { id: "d", latex: `$${a * b * c}${varName}^3$` },
        ],
        correct_choice: "a",
        correct_answer: ans,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `Multiply all coefficients: $${a} \\cdot ${b} \\cdot ${c}${varName} = ${ans}$.`,
        complexity_factor: 0.9,
        source_section: "2.2",
        tags: ["arithmetic_expressions", "multiplication"],
      };
    },
    () => {
      const s1 = randInt(3, 8);
      const s2 = randInt(3, 8);
      const s3 = randInt(3, 8);
      const varName = pick(["x", "y"]);
      const perimeter = s1 + s2 + s3;
      return {
        topic_id: "ch2.arithmetic_expressions",
        group_id: "ch2_x_marks_spot",
        difficulty: "hard",
        prompt_latex: `A triangle has sides ${s1}, ${s2}, and $${s3}${varName}$. Which expression gives its perimeter?`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${s3}${varName} + ${s1 + s2}$` },
          { id: "b", latex: `$${s1 + s2 + s3}${varName}$` },
          { id: "c", latex: `$${s3}${varName} + ${s1 * s2}$` },
          { id: "d", latex: `$${perimeter}${varName}$` },
        ],
        correct_choice: "a",
        correct_answer: `${s3}${varName} + ${s1 + s2}`,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `Add the sides: $${s1} + ${s2} + ${s3}${varName} = ${s3}${varName} + ${s1 + s2}$.`,
        complexity_factor: 0.9,
        source_section: "2.2",
        tags: ["arithmetic_expressions", "perimeter"],
      };
    },
  ];
  return pick(templates)();
}

// ---------- ch2.dist_sub_factor ----------

function generateDistSubFactorEasy(): ProblemTemplate {
  const templates: (() => ProblemTemplate)[] = [
    () => {
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const c = randInt(2, 9);
      const varName = pick(["x", "y"]);
      const ans = `${a * b}${varName} + ${a * c}`;
      return {
        topic_id: "ch2.dist_sub_factor",
        group_id: "ch2_x_marks_spot",
        difficulty: "easy",
        prompt_latex: `Distribute: $${a}(${b}${varName} + ${c})$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a + b}${varName} + ${c}$` },
          { id: "c", latex: `$${a * b}${varName} + ${c}$` },
          { id: "d", latex: `$${a * b * c}${varName}$` },
        ],
        correct_choice: "a",
        correct_answer: ans,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `$${a}(${b}${varName} + ${c}) = ${a} \\cdot ${b}${varName} + ${a} \\cdot ${c} = ${ans}$.`,
        complexity_factor: 0.8,
        source_section: "2.3",
        tags: ["distribution"],
      };
    },
    () => {
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const c = randInt(2, 9);
      const varName = pick(["x", "y"]);
      const ans = `${a * b}${varName} - ${a * c}`;
      return {
        topic_id: "ch2.dist_sub_factor",
        group_id: "ch2_x_marks_spot",
        difficulty: "easy",
        prompt_latex: `Distribute: $${a}(${b}${varName} - ${c})$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a * b}${varName} + ${a * c}$` },
          { id: "c", latex: `$${a + b}${varName} - ${c}$` },
          { id: "d", latex: `$${a * b * c}${varName}$` },
        ],
        correct_choice: "a",
        correct_answer: ans,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `$${a}(${b}${varName} - ${c}) = ${a} \\cdot ${b}${varName} - ${a} \\cdot ${c} = ${ans}$.`,
        complexity_factor: 0.8,
        source_section: "2.3",
        tags: ["distribution"],
      };
    },
    () => {
      const a = randInt(5, 9);
      const b = randInt(2, 9);
      const c = randInt(2, 5);
      const d = randInt(1, 4);
      const varName = pick(["x", "y"]);
      const ans = `${a - c}${varName} + ${b - d}`;
      return {
        topic_id: "ch2.dist_sub_factor",
        group_id: "ch2_x_marks_spot",
        difficulty: "easy",
        prompt_latex: `Subtract: $(${a}${varName} + ${b}) - (${c}${varName} + ${d})$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a + c}${varName} + ${b + d}$` },
          { id: "c", latex: `$${a - c}${varName} - ${b - d}$` },
          { id: "d", latex: `$${a * c}${varName}^2 + ${b * d}$` },
        ],
        correct_choice: "a",
        correct_answer: ans,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `Distribute the negative: $${a}${varName} + ${b} - ${c}${varName} - ${d} = ${ans}$.`,
        complexity_factor: 0.8,
        source_section: "2.3",
        tags: ["subtraction"],
      };
    },
    () => {
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const c = randInt(2, 9);
      const varName = pick(["x", "y"]);
      const g = gcd(a, b);
      const ans = `${a / g}${varName} + ${b / g}`;
      return {
        topic_id: "ch2.dist_sub_factor",
        group_id: "ch2_x_marks_spot",
        difficulty: "easy",
        prompt_latex: `Factor out the greatest common factor: $${a}${varName} + ${b}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${g}(${ans})$` },
          { id: "b", latex: `$${g}(${a / g}${varName} - ${b / g})$` },
          { id: "c", latex: `$${a}(${varName} + ${b})$` },
          { id: "d", latex: `$${g}${varName}(${a / g} + ${b / g})$` },
        ],
        correct_choice: "a",
        correct_answer: `${g}(${ans})`,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `The GCF of ${a} and ${b} is ${g}, so $${a}${varName} + ${b} = ${g}(${ans})$.`,
        complexity_factor: 0.8,
        source_section: "2.3",
        tags: ["factoring", "gcf"],
      };
    },
    () => {
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const c = randInt(2, 9);
      const varName = pick(["x", "y"]);
      const ans = `${a * b}${varName} + ${a * c}`;
      return {
        topic_id: "ch2.dist_sub_factor",
        group_id: "ch2_x_marks_spot",
        difficulty: "easy",
        prompt_latex: `Which expression is equivalent to $${a}(${b}${varName} + ${c})$?`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a + b}${varName} + ${a + c}$` },
          { id: "c", latex: `$${a * b}${varName} + ${c}$` },
          { id: "d", latex: `$${a}${varName} + ${b}${varName} + ${c}$` },
        ],
        correct_choice: "a",
        correct_answer: ans,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `Distribute the ${a}: $${a} \\cdot ${b}${varName} + ${a} \\cdot ${c} = ${ans}$.`,
        complexity_factor: 0.8,
        source_section: "2.3",
        tags: ["distribution"],
      };
    },
  ];
  return pick(templates)();
}

function generateDistSubFactorMedium(): ProblemTemplate {
  const templates: (() => ProblemTemplate)[] = [
    () => {
      const a = randInt(2, 6);
      const b = randInt(2, 6);
      const c = randInt(2, 6);
      const d = randInt(2, 6);
      const varName = pick(["x", "y"]);
      const ans = `${a * b}${varName} + ${a * c - d}`;
      return {
        topic_id: "ch2.dist_sub_factor",
        group_id: "ch2_x_marks_spot",
        difficulty: "medium",
        prompt_latex: `Simplify $${a}(${b}${varName} + ${c}) - ${d}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a * b}${varName} + ${a * c + d}$` },
          { id: "c", latex: `$${a + b}${varName} + ${c - d}$` },
          { id: "d", latex: `$${a * b}${varName}^2 + ${a * c - d}$` },
        ],
        correct_choice: "a",
        correct_answer: ans,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `Distribute and combine constants: $${a * b}${varName} + ${a * c} - ${d} = ${ans}$.`,
        complexity_factor: 0.9,
        source_section: "2.3",
        tags: ["distribution", "combining"],
      };
    },
    () => {
      const a = randInt(2, 6);
      const b = randInt(2, 6);
      const c = randInt(2, 6);
      const d = randInt(2, 6);
      const varName = pick(["x", "y"]);
      const ans = `${a * b + c}${varName} + ${a * d}`;
      return {
        topic_id: "ch2.dist_sub_factor",
        group_id: "ch2_x_marks_spot",
        difficulty: "medium",
        prompt_latex: `Simplify $${a}(${b}${varName} + ${d}) + ${c}${varName}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a * b + c}${varName} + ${a + d}$` },
          { id: "c", latex: `$${a * b}${varName} + ${c}${varName} + ${a * d}$` },
          { id: "d", latex: `$${a * b * c}${varName}^2 + ${a * d}$` },
        ],
        correct_choice: "a",
        correct_answer: ans,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `Distribute then combine like terms: $${a * b}${varName} + ${a * d} + ${c}${varName} = ${ans}$.`,
        complexity_factor: 0.9,
        source_section: "2.3",
        tags: ["distribution", "like_terms"],
      };
    },
    () => {
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const c = randInt(2, 9);
      const d = randInt(2, 9);
      const varName = pick(["x", "y"]);
      const ans = `${a - c}${varName} + ${b - d}`;
      return {
        topic_id: "ch2.dist_sub_factor",
        group_id: "ch2_x_marks_spot",
        difficulty: "medium",
        prompt_latex: `Subtract: $(${a}${varName} + ${b}) - (${c}${varName} + ${d})$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a + c}${varName} + ${b + d}$` },
          { id: "c", latex: `$${a - c}${varName} - ${b - d}$` },
          { id: "d", latex: `$${a * c}${varName}^2 + ${b * d}$` },
        ],
        correct_choice: "a",
        correct_answer: ans,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `Distribute the negative: $${a}${varName} + ${b} - ${c}${varName} - ${d} = ${ans}$.`,
        complexity_factor: 0.9,
        source_section: "2.3",
        tags: ["subtraction", "like_terms"],
      };
    },
    () => {
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const c = randInt(2, 9);
      const varName = pick(["x", "y"]);
      const ans = `${a - c}${varName} + ${b}`;
      return {
        topic_id: "ch2.dist_sub_factor",
        group_id: "ch2_x_marks_spot",
        difficulty: "medium",
        prompt_latex: `Simplify $${a}${varName} + ${b} - ${c}${varName}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a + c}${varName} + ${b}$` },
          { id: "c", latex: `$${a - c}${varName} - ${b}$` },
          { id: "d", latex: `$${a * c}${varName}^2 + ${b}$` },
        ],
        correct_choice: "a",
        correct_answer: ans,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `Combine like terms: $(${a} - ${c})${varName} + ${b} = ${ans}$.`,
        complexity_factor: 0.9,
        source_section: "2.3",
        tags: ["subtraction", "like_terms"],
      };
    },
    () => {
      const a = randInt(4, 12);
      const b = randInt(4, 12);
      const c = randInt(2, 5);
      const varName = pick(["x", "y"]);
      const g = gcd(gcd(a, b), c);
      const ans = `${a / g}${varName} + ${b / g}`;
      return {
        topic_id: "ch2.dist_sub_factor",
        group_id: "ch2_x_marks_spot",
        difficulty: "medium",
        prompt_latex: `Factor out the greatest common factor: $${a}${varName} + ${b}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${g}(${ans})$` },
          { id: "b", latex: `$${c}(${Math.round(a / c)}${varName} + ${Math.round(b / c)})$` },
          { id: "c", latex: `$${g}${varName}(${a / g} + ${b / g})$` },
          { id: "d", latex: `$${a}${varName} + ${b}$` },
        ],
        correct_choice: "a",
        correct_answer: `${g}(${ans})`,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `The GCF of ${a} and ${b} is ${g}, so $${a}${varName} + ${b} = ${g}(${ans})$.`,
        complexity_factor: 0.9,
        source_section: "2.3",
        tags: ["factoring", "gcf"],
      };
    },
  ];
  return pick(templates)();
}

function generateDistSubFactorHard(): ProblemTemplate {
  const templates: (() => ProblemTemplate)[] = [
    () => {
      const a = randInt(2, 6);
      const b = randInt(2, 6);
      const c = randInt(2, 6);
      const d = randInt(2, 6);
      const e = randInt(2, 6);
      const varName = pick(["x", "y"]);
      const ans = `${a * b + e}${varName} + ${a * c - d}`;
      return {
        topic_id: "ch2.dist_sub_factor",
        group_id: "ch2_x_marks_spot",
        difficulty: "hard",
        prompt_latex: `Simplify $${a}(${b}${varName} + ${c}) - ${d} + ${e}${varName}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a * b + e}${varName} + ${a * c + d}$` },
          { id: "c", latex: `$${a * b}${varName} + ${a * c - d + e}${varName}$` },
          { id: "d", latex: `$${a * b + e}${varName}^2 + ${a * c - d}$` },
        ],
        correct_choice: "a",
        correct_answer: ans,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `Distribute and combine: $${a * b}${varName} + ${a * c} - ${d} + ${e}${varName} = ${ans}$.`,
        complexity_factor: 1.0,
        source_section: "2.3",
        tags: ["distribution", "subtraction", "like_terms"],
      };
    },
    () => {
      const a = randInt(2, 6);
      const b = randInt(2, 6);
      const c = randInt(2, 6);
      const d = randInt(2, 6);
      const e = randInt(2, 6);
      const varName = pick(["x", "y"]);
      const ans = `${a * b - e}${varName} + ${a * c - d}`;
      return {
        topic_id: "ch2.dist_sub_factor",
        group_id: "ch2_x_marks_spot",
        difficulty: "hard",
        prompt_latex: `Simplify $${a}(${b}${varName} + ${c}) - (${d} + ${e}${varName})$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a * b + e}${varName} + ${a * c - d}$` },
          { id: "c", latex: `$${a * b}${varName} + ${a * c - d - e}${varName}$` },
          { id: "d", latex: `$${a * b - e}${varName}^2 + ${a * c - d}$` },
        ],
        correct_choice: "a",
        correct_answer: ans,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `Distribute both signs: $${a * b}${varName} + ${a * c} - ${d} - ${e}${varName} = ${ans}$.`,
        complexity_factor: 1.0,
        source_section: "2.3",
        tags: ["distribution", "subtraction", "like_terms"],
      };
    },
    () => {
      const a = randInt(6, 15);
      const b = randInt(6, 15);
      const c = randInt(2, 5);
      const d = randInt(2, 5);
      const varName = pick(["x", "y"]);
      const g = gcd(gcd(a, b), gcd(c, d));
      const ans = `${a / g}${varName} + ${b / g}`;
      return {
        topic_id: "ch2.dist_sub_factor",
        group_id: "ch2_x_marks_spot",
        difficulty: "hard",
        prompt_latex: `Factor out the greatest common factor: $${a}${varName} + ${b}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${g}(${ans})$` },
          { id: "b", latex: `$${c}(${Math.round(a / c)}${varName} + ${Math.round(b / c)})$` },
          { id: "c", latex: `$${d}(${Math.round(a / d)}${varName} + ${Math.round(b / d)})$` },
          { id: "d", latex: `$${g}${varName}(${a / g} + ${b / g})$` },
        ],
        correct_choice: "a",
        correct_answer: `${g}(${ans})`,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `The GCF of ${a} and ${b} is ${g}, so $${a}${varName} + ${b} = ${g}(${ans})$.`,
        complexity_factor: 1.0,
        source_section: "2.3",
        tags: ["factoring", "gcf"],
      };
    },
    () => {
      const a = randInt(2, 6);
      const b = randInt(2, 6);
      const c = randInt(2, 6);
      const varName = pick(["x", "y"]);
      const ans = `${a * b}${varName} - ${a * c}`;
      return {
        topic_id: "ch2.dist_sub_factor",
        group_id: "ch2_x_marks_spot",
        difficulty: "hard",
        prompt_latex: `Which expression is equivalent to $${a}(${b}${varName} - ${c})$?`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${ans}$` },
          { id: "b", latex: `$${a * b}${varName} + ${a * c}$` },
          { id: "c", latex: `$${a + b}${varName} - ${a + c}$` },
          { id: "d", latex: `$${a * b * c}${varName}$` },
        ],
        correct_choice: "a",
        correct_answer: ans,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `Distribute the ${a}: $${a} \\cdot ${b}${varName} - ${a} \\cdot ${c} = ${ans}$.`,
        complexity_factor: 1.0,
        source_section: "2.3",
        tags: ["distribution"],
      };
    },
  ];
  return pick(templates)();
}

// ---------- ch2.fractions ----------

function generateFractionsEasy(): ProblemTemplate {
  const templates: (() => ProblemTemplate)[] = [
    () => {
      const num = randInt(2, 9);
      const den = randInt(2, 9);
      const varName = pick(["x", "y"]);
      const g = gcd(num, den);
      const ansNum = num / g;
      const ansDen = den / g;
      return {
        topic_id: "ch2.fractions",
        group_id: "ch2_x_marks_spot",
        difficulty: "easy",
        prompt_latex: `Simplify $\\dfrac{${num}${varName}}{${den}}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$\\dfrac{${ansNum}${varName}}{${ansDen}}$` },
          { id: "b", latex: `$\\dfrac{${num}${varName}}{${den - 1}}$` },
          { id: "c", latex: `$\\dfrac{${num - 1}${varName}}{${den}}$` },
          { id: "d", latex: `$\\dfrac{${num + den}${varName}}{${den}}$` },
        ],
        correct_choice: "a",
        correct_answer: `${ansNum}${varName}/${ansDen}`,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `Reduce the fraction by dividing numerator and denominator by ${g}: $\\dfrac{${ansNum}${varName}}{${ansDen}}$.`,
        complexity_factor: 0.8,
        source_section: "2.4",
        tags: ["fractions", "simplifying"],
      };
    },
    () => {
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const c = randInt(2, 9);
      const varName = pick(["x", "y"]);
      const g = gcd(a * c, b);
      const ansNum = (a * c) / g;
      const ansDen = b / g;
      return {
        topic_id: "ch2.fractions",
        group_id: "ch2_x_marks_spot",
        difficulty: "easy",
        prompt_latex: `Simplify $\\dfrac{${a}}{${b}} \\cdot ${c}${varName}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$\\dfrac{${ansNum}${varName}}{${ansDen}}$` },
          { id: "b", latex: `$\\dfrac{${a * c}${varName}}{${b + 1}}$` },
          { id: "c", latex: `$\\dfrac{${a + c}${varName}}{${b}}$` },
          { id: "d", latex: `$\\dfrac{${a * c}${varName}^2}{${b}}$` },
        ],
        correct_choice: "a",
        correct_answer: `${ansNum}${varName}/${ansDen}`,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `Multiply: $\\dfrac{${a} \\cdot ${c}${varName}}{${b}} = \\dfrac{${ansNum}${varName}}{${ansDen}}$.`,
        complexity_factor: 0.8,
        source_section: "2.4",
        tags: ["fractions", "multiplication"],
      };
    },
    () => {
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const c = randInt(2, 9);
      const varName = pick(["x", "y"]);
      const num = a * c;
      const den = b;
      const g = gcd(num, den);
      const ansNum = num / g;
      const ansDen = den / g;
      return {
        topic_id: "ch2.fractions",
        group_id: "ch2_x_marks_spot",
        difficulty: "easy",
        prompt_latex: `Simplify $\\dfrac{${a}}{${b}} \\cdot \\dfrac{${c}${varName}}{1}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$\\dfrac{${ansNum}${varName}}{${ansDen}}$` },
          { id: "b", latex: `$\\dfrac{${a + c}${varName}}{${b}}$` },
          { id: "c", latex: `$\\dfrac{${num}${varName}}{${b + 1}}$` },
          { id: "d", latex: `$\\dfrac{${a * b}${varName}}{${c}}$` },
        ],
        correct_choice: "a",
        correct_answer: `${ansNum}${varName}/${ansDen}`,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `Multiply numerators and denominators: $\\dfrac{${num}${varName}}{${b}}$, then reduce.`,
        complexity_factor: 0.8,
        source_section: "2.4",
        tags: ["fractions", "multiplication"],
      };
    },
    () => {
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const c = randInt(2, 9);
      const varName = pick(["x", "y"]);
      const ansNum = a + c;
      const ansDen = b;
      const g = gcd(ansNum, ansDen);
      return {
        topic_id: "ch2.fractions",
        group_id: "ch2_x_marks_spot",
        difficulty: "easy",
        prompt_latex: `Simplify $\\dfrac{${a}}{${b}} + \\dfrac{${c}}{${b}}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$\\dfrac{${ansNum / g}}{${ansDen / g}}$` },
          { id: "b", latex: `$\\dfrac{${a + c}}{${2 * b}}$` },
          { id: "c", latex: `$\\dfrac{${a * c}}{${b}}$` },
          { id: "d", latex: `$\\dfrac{${ansNum}}{${ansDen + 1}}$` },
        ],
        correct_choice: "a",
        correct_answer: `${ansNum / g}/${ansDen / g}`,
        answer_type: "fraction",
        solution_latex: `Add the numerators: $\\dfrac{${a} + ${c}}{${b}} = \\dfrac{${ansNum}}{${ansDen}}$, then reduce.`,
        complexity_factor: 0.8,
        source_section: "2.4",
        tags: ["fractions", "addition"],
      };
    },
    () => {
      const a = randInt(3, 9);
      const b = randInt(2, 5);
      const c = randInt(1, 4);
      const varName = pick(["x", "y"]);
      const ansNum = a - c;
      const ansDen = b;
      const g = gcd(ansNum, ansDen);
      return {
        topic_id: "ch2.fractions",
        group_id: "ch2_x_marks_spot",
        difficulty: "easy",
        prompt_latex: `Simplify $\\dfrac{${a}${varName}}{${b}} - \\dfrac{${c}${varName}}{${b}}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$\\dfrac{${(ansNum / g)}${varName}}{${ansDen / g}}$` },
          { id: "b", latex: `$\\dfrac{${a - c}${varName}}{${b * 2}}$` },
          { id: "c", latex: `$\\dfrac{${a + c}${varName}}{${b}}$` },
          { id: "d", latex: `$\\dfrac{${a * c}${varName}}{${b}}$` },
        ],
        correct_choice: "a",
        correct_answer: `${(ansNum / g)}${varName}/${ansDen / g}`,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `Subtract numerators: $\\dfrac{${a}${varName} - ${c}${varName}}{${b}} = \\dfrac{${ansNum}${varName}}{${b}}$, then reduce.`,
        complexity_factor: 0.8,
        source_section: "2.4",
        tags: ["fractions", "subtraction"],
      };
    },
  ];
  return pick(templates)();
}

function generateFractionsMedium(): ProblemTemplate {
  const templates: (() => ProblemTemplate)[] = [
    () => {
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const c = randInt(2, 9);
      const d = randInt(2, 9);
      const varName = pick(["x", "y"]);
      const num = a * c;
      const den = b * d;
      const g = gcd(num, den);
      const ansNum = num / g;
      const ansDen = den / g;
      const correctLatex = `\\dfrac{${ansNum}${varName}}{${ansDen}}`;
      return {
        topic_id: "ch2.fractions",
        group_id: "ch2_x_marks_spot",
        difficulty: "medium",
        prompt_latex: `Simplify $\\dfrac{${a}}{${b}} \\cdot \\dfrac{${c}${varName}}{${d}}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${correctLatex}$` },
          { id: "b", latex: `$\\dfrac{${a + c}${varName}}{${b + d}}$` },
          { id: "c", latex: `$\\dfrac{${num}${varName}}{${den + 1}}$` },
          { id: "d", latex: `$\\dfrac{${num}${varName}^2}{${den}}$` },
        ],
        correct_choice: "a",
        correct_answer: correctLatex,
        answer_type: "expression",
        accepted_forms: [`${ansNum}${varName}/${ansDen}`],
        solution_latex: `Multiply numerators and denominators: $\\dfrac{${num}${varName}}{${den}}$, then reduce to $${correctLatex}$.`,
        complexity_factor: 0.9,
        source_section: "2.4",
        tags: ["fractions", "multiplication"],
      };
    },
    () => {
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const c = randInt(2, 9);
      const d = randInt(2, 9);
      const varName = pick(["x", "y"]);
      const num = a * d;
      const den = b * c;
      const g = gcd(num, den);
      const ansNum = num / g;
      const ansDen = den / g;
      const correctLatex = `\\dfrac{${ansNum}${varName}}{${ansDen}}`;
      return {
        topic_id: "ch2.fractions",
        group_id: "ch2_x_marks_spot",
        difficulty: "medium",
        prompt_latex: `Simplify $\\dfrac{${a}}{${b}} \\div \\dfrac{${c}}{${d}${varName}}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${correctLatex}$` },
          { id: "b", latex: `$\\dfrac{${a * c}}{${b * d}${varName}}$` },
          { id: "c", latex: `$\\dfrac{${a * d}}{${b * c}}$` },
          { id: "d", latex: `$\\dfrac{${ansNum}}{${ansDen}${varName}}$` },
        ],
        correct_choice: "a",
        correct_answer: correctLatex,
        answer_type: "expression",
        accepted_forms: [`${ansNum}${varName}/${ansDen}`],
        solution_latex: `Invert and multiply: $\\dfrac{${a}}{${b}} \\cdot \\dfrac{${d}${varName}}{${c}} = ${correctLatex}$.`,
        complexity_factor: 0.9,
        source_section: "2.4",
        tags: ["fractions", "division"],
      };
    },
    () => {
      const a = randInt(2, 5);
      const b = randInt(2, 5);
      const c = randInt(2, 5);
      const lcm = (b * c) / gcd(b, c);
      const firstNum = (a * lcm) / b;
      const secondNum = (a * lcm) / c;
      const ansNum = firstNum + secondNum;
      const g = gcd(ansNum, lcm);
      return {
        topic_id: "ch2.fractions",
        group_id: "ch2_x_marks_spot",
        difficulty: "medium",
        prompt_latex: `Simplify $\\dfrac{${a}}{${b}} + \\dfrac{${a}}{${c}}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$\\dfrac{${ansNum / g}}{${lcm / g}}$` },
          { id: "b", latex: `$\\dfrac{${2 * a}}{${b + c}}$` },
          { id: "c", latex: `$\\dfrac{${a * a}}{${b * c}}$` },
          { id: "d", latex: `$\\dfrac{${ansNum + 1}}{${lcm}}$` },
        ],
        correct_choice: "a",
        correct_answer: `${ansNum / g}/${lcm / g}`,
        answer_type: "fraction",
        solution_latex: `Use the common denominator ${lcm}: $\\dfrac{${firstNum}}{${lcm}} + \\dfrac{${secondNum}}{${lcm}} = \\dfrac{${ansNum}}{${lcm}}$, then reduce.`,
        complexity_factor: 0.9,
        source_section: "2.4",
        tags: ["fractions", "addition"],
      };
    },
    () => {
      const a = randInt(2, 5);
      const b = randInt(2, 5);
      const c = randInt(2, 5);
      const varName = pick(["x", "y"]);
      const lcm = (b * c) / gcd(b, c);
      const firstNum = (a * lcm) / b;
      const secondNum = (lcm) / c;
      const ansNum = firstNum + secondNum;
      const g = gcd(ansNum, lcm);
      const correctLatex = `\\dfrac{${(ansNum / g)}${varName}}{${lcm / g}}`;
      return {
        topic_id: "ch2.fractions",
        group_id: "ch2_x_marks_spot",
        difficulty: "medium",
        prompt_latex: `Simplify $\\dfrac{${a}${varName}}{${b}} + \\dfrac{${varName}}{${c}}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$${correctLatex}$` },
          { id: "b", latex: `$\\dfrac{${a + 1}${varName}}{${b + c}}$` },
          { id: "c", latex: `$\\dfrac{${a}${varName}}{${b * c}}$` },
          { id: "d", latex: `$\\dfrac{${ansNum + 1}${varName}}{${lcm}}$` },
        ],
        correct_choice: "a",
        correct_answer: correctLatex,
        answer_type: "expression",
        accepted_forms: [`${(ansNum / g)}${varName}/${lcm / g}`],
        solution_latex: `Use common denominator ${lcm}: $\\dfrac{${firstNum}${varName} + ${secondNum}${varName}}{${lcm}} = ${correctLatex}$.`,
        complexity_factor: 0.9,
        source_section: "2.4",
        tags: ["fractions", "addition"],
      };
    },
    () => {
      const a = randInt(2, 5);
      const b = randInt(2, 5);
      const c = randInt(2, 5);
      const lcm = (b * c) / gcd(b, c);
      const firstNum = (a * lcm) / b;
      const secondNum = (lcm) / c;
      const ansNum = firstNum - secondNum;
      const g = gcd(Math.abs(ansNum), lcm);
      return {
        topic_id: "ch2.fractions",
        group_id: "ch2_x_marks_spot",
        difficulty: "medium",
        prompt_latex: `Simplify $\\dfrac{${a}}{${b}} - \\dfrac{1}{${c}}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$\\dfrac{${ansNum / g}}{${lcm / g}}$` },
          { id: "b", latex: `$\\dfrac{${a - 1}}{${b - c}}$` },
          { id: "c", latex: `$\\dfrac{${a + 1}}{${b * c}}$` },
          { id: "d", latex: `$\\dfrac{${ansNum + 1}}{${lcm}}$` },
        ],
        correct_choice: "a",
        correct_answer: `${ansNum / g}/${lcm / g}`,
        answer_type: "fraction",
        solution_latex: `Use common denominator ${lcm}: $\\dfrac{${firstNum}}{${lcm}} - \\dfrac{${secondNum}}{${lcm}} = \\dfrac{${ansNum}}{${lcm}}$, then reduce.`,
        complexity_factor: 0.9,
        source_section: "2.4",
        tags: ["fractions", "subtraction"],
      };
    },
  ];
  return pick(templates)();
}

function generateFractionsHard(): ProblemTemplate {
  const templates: (() => ProblemTemplate)[] = [
    () => {
      const a = randInt(2, 5);
      const b = randInt(2, 5);
      const c = randInt(2, 5);
      const d = randInt(2, 5);
      const e = randInt(2, 5);
      const varName = pick(["x", "y"]);
      const lcm = (b * c) / gcd(b, c);
      const firstNum = (a * lcm) / b;
      const secondNum = (e * lcm) / c;
      const ansNum = firstNum + secondNum;
      const g = gcd(ansNum, lcm);
      return {
        topic_id: "ch2.fractions",
        group_id: "ch2_x_marks_spot",
        difficulty: "hard",
        prompt_latex: `Simplify $\\dfrac{${a}}{${b}} + \\dfrac{${e}}{${c}} + \\dfrac{${d}}{${lcm}}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$\\dfrac{${(ansNum + d) / gcd(ansNum + d, lcm)}}{${lcm / gcd(ansNum + d, lcm)}}$` },
          { id: "b", latex: `$\\dfrac{${a + e + d}}{${b + c + lcm}}$` },
          { id: "c", latex: `$\\dfrac{${ansNum + d + 1}}{${lcm}}$` },
          { id: "d", latex: `$\\dfrac{${a * e * d}}{${b * c * lcm}}$` },
        ],
        correct_choice: "a",
        correct_answer: `${(ansNum + d) / gcd(ansNum + d, lcm)}/${lcm / gcd(ansNum + d, lcm)}`,
        answer_type: "fraction",
        solution_latex: `Convert to common denominator ${lcm}: $\\dfrac{${firstNum}}{${lcm}} + \\dfrac{${secondNum}}{${lcm}} + \\dfrac{${d}}{${lcm}} = \\dfrac{${ansNum + d}}{${lcm}}$, then reduce.`,
        complexity_factor: 1.0,
        source_section: "2.4",
        tags: ["fractions", "addition"],
      };
    },
    () => {
      const a = randInt(2, 5);
      const b = randInt(2, 5);
      const c = randInt(2, 5);
      const d = randInt(2, 5);
      const e = randInt(2, 5);
      const varName = pick(["x", "y"]);
      const lcm = (b * c) / gcd(b, c);
      const firstNum = (a * lcm) / b;
      const secondNum = (e * lcm) / c;
      const ansNum = firstNum - secondNum;
      const g = gcd(Math.abs(ansNum), lcm);
      return {
        topic_id: "ch2.fractions",
        group_id: "ch2_x_marks_spot",
        difficulty: "hard",
        prompt_latex: `Simplify $\\dfrac{${a}${varName}}{${b}} - \\dfrac{${e}${varName}}{${c}}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$\\dfrac{${(ansNum / g)}${varName}}{${lcm / g}}$` },
          { id: "b", latex: `$\\dfrac{${a - e}${varName}}{${b - c}}$` },
          { id: "c", latex: `$\\dfrac{${a + e}${varName}}{${b + c}}$` },
          { id: "d", latex: `$\\dfrac{${ansNum + 1}${varName}}{${lcm}}$` },
        ],
        correct_choice: "a",
        correct_answer: `${(ansNum / g)}${varName}/${lcm / g}`,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `Use common denominator ${lcm}: $\\dfrac{${firstNum}${varName} - ${secondNum}${varName}}{${lcm}} = \\dfrac{${ansNum}${varName}}{${lcm}}$, then reduce.`,
        complexity_factor: 1.0,
        source_section: "2.4",
        tags: ["fractions", "subtraction"],
      };
    },
    () => {
      const a = randInt(2, 5);
      const b = randInt(2, 5);
      const c = randInt(2, 5);
      const d = randInt(2, 5);
      const e = randInt(2, 5);
      const varName = pick(["x", "y"]);
      const num = a * d * e;
      const den = b * c;
      const g = gcd(num, den);
      return {
        topic_id: "ch2.fractions",
        group_id: "ch2_x_marks_spot",
        difficulty: "hard",
        prompt_latex: `Simplify $\\dfrac{${a}}{${b}} \\cdot \\dfrac{${c}${varName}}{${d}} \\div \\dfrac{${e}}{${c}}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$\\dfrac{${num / g}${varName}}{${den / g}}$` },
          { id: "b", latex: `$\\dfrac{${a * c * e}${varName}}{${b * d * c}}$` },
          { id: "c", latex: `$\\dfrac{${a + c + e}${varName}}{${b + d + c}}$` },
          { id: "d", latex: `$\\dfrac{${num}${varName}^2}{${den}}$` },
        ],
        correct_choice: "a",
        correct_answer: `${num / g}${varName}/${den / g}`,
        answer_type: "expression",
        accepted_forms: [],
        solution_latex: `Invert the divisor and multiply: $\\dfrac{${a}}{${b}} \\cdot \\dfrac{${c}${varName}}{${d}} \\cdot \\dfrac{${c}}{${e}} = \\dfrac{${num}${varName}}{${den}}$, then reduce.`,
        complexity_factor: 1.0,
        source_section: "2.4",
        tags: ["fractions", "multiplication", "division"],
      };
    },
    () => {
      const a = randInt(2, 5);
      const b = randInt(2, 5);
      const c = randInt(2, 5);
      const d = randInt(2, 5);
      const varName = pick(["x", "y"]);
      const num1 = a * d + b * c;
      const num2 = a * d;
      const finalNum = num1 + num2;
      const lcm = b * d;
      const g = gcd(finalNum, lcm);
      return {
        topic_id: "ch2.fractions",
        group_id: "ch2_x_marks_spot",
        difficulty: "hard",
        prompt_latex: `Simplify $\\dfrac{${a}}{${b}} + \\dfrac{${c}}{${d}} + \\dfrac{${a}}{${b}}$.`,
        answer_format: "mc",
        choices: [
          { id: "a", latex: `$\\dfrac{${finalNum / g}}{${lcm / g}}$` },
          { id: "b", latex: `$\\dfrac{${2 * a + c}}{${b + d}}$` },
          { id: "c", latex: `$\\dfrac{${finalNum + 1}}{${lcm}}$` },
          { id: "d", latex: `$\\dfrac{${a * c * 2}}{${b * d}}$` },
        ],
        correct_choice: "a",
        correct_answer: `${finalNum / g}/${lcm / g}`,
        answer_type: "fraction",
        solution_latex: `Common denominator is ${lcm}: $\\dfrac{${a * d}}{${lcm}} + \\dfrac{${b * c}}{${lcm}} + \\dfrac{${a * d}}{${lcm}} = \\dfrac{${finalNum}}{${lcm}}$, then reduce.`,
        complexity_factor: 1.0,
        source_section: "2.4",
        tags: ["fractions", "addition"],
      };
    },
  ];
  return pick(templates)();
}

// ---------- main generation ----------

const generatorMap: Record<string, Record<Difficulty, () => ProblemTemplate>> = {
  "ch2.expressions": {
    easy: generateExpressionsEasy,
    medium: generateExpressionsMedium,
    hard: generateExpressionsHard,
  },
  "ch2.arithmetic_expressions": {
    easy: generateArithmeticEasy,
    medium: generateArithmeticMedium,
    hard: generateArithmeticHard,
  },
  "ch2.dist_sub_factor": {
    easy: generateDistSubFactorEasy,
    medium: generateDistSubFactorMedium,
    hard: generateDistSubFactorHard,
  },
  "ch2.fractions": {
    easy: generateFractionsEasy,
    medium: generateFractionsMedium,
    hard: generateFractionsHard,
  },
};

function unwrapMath(source: string): string {
  return source
    .trim()
    .replace(/^\$\$(.*)\$\$$/, "$1")
    .replace(/^\\\[(.*)\\\]$/, "$1")
    .replace(/^\\\((.*)\\\)$/, "$1")
    .replace(/^\$(.*)\$$/, "$1")
    .trim();
}

function isValidProblem(problem: ProblemTemplate, usedChecksums: Set<string>): { ok: boolean; reason?: string } {
  // Checksum uniqueness
  const checksum = computeChecksum(problem);
  if (usedChecksums.has(checksum)) {
    return { ok: false, reason: "duplicate checksum" };
  }

  // Shuffle and validate choices
  const shuffled = shuffleChoices(problem.choices, problem.correct_choice);
  const correctLatex = unwrapMath(
    problem.choices.find((c) => c.id === problem.correct_choice)!.latex
  );

  // Correct choice must match correct_answer
  if (!answersEquivalent(correctLatex, problem.correct_answer, problem.answer_type, problem.accepted_forms)) {
    return { ok: false, reason: "correct choice does not match correct_answer" };
  }

  // Distractor checks
  const seen = new Set<string>();
  for (const choice of shuffled.choices) {
    if (choice.id === shuffled.correctChoice) continue;
    const unwrapped = unwrapMath(choice.latex);
    const normalized = normalizeAnswer(unwrapped, problem.answer_type);
    if (normalized === null) {
      return { ok: false, reason: `distractor ${choice.id} is not a valid ${problem.answer_type}` };
    }
    if (answersEquivalent(unwrapped, problem.correct_answer, problem.answer_type, problem.accepted_forms)) {
      return { ok: false, reason: `distractor ${choice.id} matches correct answer` };
    }
    const key = typeof normalized === "string" ? normalized : JSON.stringify(normalized);
    if (seen.has(key)) {
      return { ok: false, reason: `duplicate distractor ${choice.id}` };
    }
    seen.add(key);
  }

  return { ok: true };
}

const problemsDir = path.join(process.cwd(), "content", "problems");
const targetDir = path.join(problemsDir, "ch2_x_marks_spot");
fs.mkdirSync(targetDir, { recursive: true });

const COUNT = 50;
const MAX_ATTEMPTS = 500;

for (const [topicId, difficulties] of Object.entries(generatorMap)) {
  for (const difficulty of ["easy", "medium", "hard"] as Difficulty[]) {
    const problems: ProblemTemplate[] = [];
    const usedChecksums = new Set<string>();
    let attempts = 0;
    while (problems.length < COUNT && attempts < MAX_ATTEMPTS) {
      attempts++;
      const template = difficulties[difficulty]();
      const validation = isValidProblem(template, usedChecksums);
      if (!validation.ok) {
        continue;
      }
      const shuffled = shuffleChoices(template.choices, template.correct_choice);
      const problem: any = { ...template };
      problem.id = makeId(template, problems.length + 1);
      problem.checksum = computeChecksum(problem);
      problem.status = "valid";
      problem.choices = shuffled.choices;
      problem.correct_choice = shuffled.correctChoice;
      problems.push(problem);
      usedChecksums.add(problem.checksum);
    }
    if (problems.length < COUNT) {
      console.error(`WARNING: only generated ${problems.length}/${COUNT} for ${topicId} ${difficulty} after ${attempts} attempts`);
    }
    const filePath = path.join(targetDir, `${topicId}.${difficulty}.json`);
    fs.writeFileSync(filePath, JSON.stringify(problems, null, 2));
    console.log(`wrote ${problems.length} problems to ${filePath}`);
  }
}

console.log("ch2_x_marks_spot generation complete");
