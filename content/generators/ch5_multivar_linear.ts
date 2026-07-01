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
  accepted_forms?: string[];
  solution_latex: string;
  complexity_factor: number;
  source_section: string;
  tags: string[];
  checksum: string;
  status: "valid";
}

const GROUP_ID = "ch5_multivar_linear";

class SeededRandom {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }
  next(): number {
    // xorshift32
    this.state ^= this.state << 13;
    this.state ^= this.state >>> 17;
    this.state ^= this.state << 5;
    return (this.state >>> 0) / 4294967296;
  }
  randInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  choice<T>(arr: T[]): T {
    return arr[this.randInt(0, arr.length - 1)];
  }
  shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.randInt(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
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
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) {
    return { num: num || 0, den: den || 1 };
  }
  const g = gcd(num, den);
  let n = num / g;
  let d = den / g;
  if (d < 0) {
    n = -n;
    d = -d;
  }
  return { num: n, den: d };
}

function fracString(num: number, den: number): string {
  const r = reduceFraction(num, den);
  return `${r.num}/${r.den}`;
}

function fracLatex(num: number, den: number): string {
  const r = reduceFraction(num, den);
  return `\\dfrac{${r.num}}{${r.den}}`;
}

function signed(n: number): string {
  return n >= 0 ? `+ ${n}` : `- ${Math.abs(n)}`;
}

function signedTerm(c: number, varName: string): string {
  if (c === 0) return "0";
  if (c === 1) return varName;
  if (c === -1) return `-${varName}`;
  return `${c}${varName}`;
}

function linearExpr(c1: number, c2: number, var1 = "x", var2 = "y"): string {
  const parts: string[] = [];
  if (c1 !== 0) parts.push(signedTerm(c1, var1));
  if (c2 !== 0) parts.push((c2 > 0 && parts.length > 0 ? "+ " : "") + signedTerm(c2, var2));
  if (parts.length === 0) return "0";
  return parts.join(" ").replace(/\+ -/g, "- ");
}

function formatOrderedPair(x: number, y: number): string {
  return `(${x},${y})`;
}

function formatOrderedPair3(x: number, y: number, z: number): string {
  return `(${x},${y},${z})`;
}

function parseOrderedPairLocal(s: string): [number, number] | null {
  const match = s.match(/^\(?(-?\d+),(-?\d+)\)?$/);
  if (!match) return null;
  return [parseInt(match[1], 10), parseInt(match[2], 10)];
}

function parseFractionLocal(s: string): { num: number; den: number } | null {
  const match = s.match(/^(-?\d+)\/(-?\d+)$/);
  if (!match) return null;
  return { num: parseInt(match[1], 10), den: parseInt(match[2], 10) };
}

function inferAnswerType(problem: Problem): AnswerType {
  const correct = problem.correct_answer.trim();
  if (/^\(-?\d+,-?\d+,-?\d+\)$/.test(correct)) return "string";
  if (/^\(-?\d+,-?\d+\)$/.test(correct)) return "ordered_pair";
  if (/^(-?\d+)\/(-?\d+)$/.test(correct)) return "fraction";
  if (/^(-?\d+)$/.test(correct)) {
    if (/how many solutions/i.test(problem.prompt_latex)) return "string";
    return "integer";
  }
  if (correct === "true" || correct === "false") return "boolean";
  return problem.answer_type;
}

function fixDistractors(problem: Problem, rng: SeededRandom): Problem {
  // Correct answer_type if generator set it inconsistently.
  problem.answer_type = inferAnswerType(problem);

  // Ensure 3 valid, distinct distractors that do not match the correct answer.
  const correct = unwrapMath(problem.correct_answer);
  const type = problem.answer_type;
  let safety = 0;
  let distractors = problem.choices.filter((c) => c.id !== problem.correct_choice).map((c) => unwrapMath(c.latex));

  // Remove invalid or matching distractors.
  distractors = distractors.filter((d) => {
    if (d === correct) return false;
    if (type === "integer") return Number.isInteger(Number(d));
    if (type === "fraction") return parseFractionLocal(d) !== null;
    if (type === "ordered_pair") return parseOrderedPairLocal(d) !== null;
    return true;
  });

  // Generate replacements.
  if (type === "ordered_pair") {
    const parsed = parseOrderedPairLocal(correct);
    if (parsed) {
      const [x, y] = parsed;
      const deltas = [
        [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1], [2, 0], [0, 2], [-2, 0], [0, -2],
        [1, -1], [-1, 1], [2, 1], [1, 2], [-2, 1], [1, -2],
      ];
      while (distractors.length < 3 && safety++ < 1000) {
        const [dx, dy] = deltas[rng.randInt(0, deltas.length - 1)];
        const d = formatOrderedPair(x + dx, y + dy);
        if (d !== correct && !distractors.includes(d)) distractors.push(d);
      }
    }
  } else if (type === "integer") {
    const n = parseInt(correct, 10);
    const deltas = [1, -1, 2, -2, 3, -3, 5, -5, 10, -10];
    while (distractors.length < 3 && safety++ < 1000) {
      const d = String(n + deltas[rng.randInt(0, deltas.length - 1)]);
      if (d !== correct && !distractors.includes(d)) distractors.push(d);
    }
  } else if (type === "fraction") {
    const parsed = parseFractionLocal(correct);
    if (parsed) {
      const { num, den } = parsed;
      while (distractors.length < 3 && safety++ < 1000) {
        const dn = rng.randInt(1, 9);
        const dd = rng.randInt(2, 9);
        const cand = fracString(num + dn, den + dd);
        if (cand !== correct && !distractors.includes(cand)) distractors.push(cand);
      }
    }
  } else if (type === "string") {
    const pool = ["0", "1", "2", "infinitely many", "none", "all real numbers"];
    while (distractors.length < 3 && safety++ < 1000) {
      const d = pool[rng.randInt(0, pool.length - 1)];
      if (d !== correct && !distractors.includes(d)) distractors.push(d);
    }
  } else {
    // expression / boolean / etc.
    while (distractors.length < 3 && safety++ < 1000) {
      const d = `${correct} + 1`;
      if (d !== correct && !distractors.includes(d)) distractors.push(d);
    }
  }

  // Build new choices.
  const all = [correct, ...distractors.slice(0, 3)];
  const shuffled = rng.shuffle(all);
  const choices = shuffled.map((latex, idx) => ({ id: ["a", "b", "c", "d"][idx], latex: `$${latex}$` }));
  const correctChoiceId = choices.find((c) => unwrapMath(c.latex) === correct)!.id;
  problem.choices = choices;
  problem.correct_choice = correctChoiceId;
  problem.checksum = computeChecksum(problem);
  return problem;
}

function computeChecksum(problem: Partial<Problem>): string {
  const payload =
    (problem.topic_id ?? "") +
    (problem.difficulty ?? "") +
    (problem.prompt_latex ?? "") +
    (problem.correct_answer ?? "");
  return "sha256-" + crypto.createHash("sha256").update(payload).digest("hex");
}

function makeProblem(
  topicId: string,
  difficulty: Difficulty,
  index: number,
  prompt: string,
  answerType: AnswerType,
  correctAnswer: string,
  choices: Choice[],
  correctChoiceId: string,
  solution: string,
  complexityFactor: number,
  sourceSection: string,
  tags: string[],
  acceptedForms?: string[]
): Problem {
  const problem: Problem = {
    id: `${topicId}.${difficulty}.${String(index + 1).padStart(4, "0")}`,
    topic_id: topicId,
    group_id: GROUP_ID,
    difficulty,
    prompt_latex: prompt,
    answer_format: "mc",
    choices,
    correct_choice: correctChoiceId,
    correct_answer: correctAnswer,
    answer_type: answerType,
    accepted_forms: acceptedForms ?? [],
    solution_latex: solution,
    complexity_factor: complexityFactor,
    source_section: sourceSection,
    tags,
    checksum: "",
    status: "valid",
  };
  problem.checksum = computeChecksum(problem);
  return problem;
}

function makeChoices(
  correctLatex: string,
  distractors: string[],
  rng: SeededRandom
): { choices: Choice[]; correctChoiceId: string } {
  const all = [correctLatex, ...distractors];
  const shuffled = rng.shuffle(all);
  const choices = shuffled.map((latex, idx) => ({
    id: ["a", "b", "c", "d"][idx],
    latex: `$${latex}$`,
  }));
  const correctChoiceId = choices.find((c) => unwrapMath(c.latex) === correctLatex)!.id;
  return { choices, correctChoiceId };
}

function unwrapMath(source: string): string {
  return source
    .trim()
    .replace(/^\$\$(.*)\$\$$/, "$1")
    .replace(/^\\\[(.*)\\\]$/, "$1")
    .replace(/^\\\((.*)\\\)$/, "$1")
    .replace(/^\$(.*)\$$/, "$1")
    .trim();
}

function generateIntroTwoVar(difficulty: Difficulty, rng: SeededRandom): Problem[] {
  const topicId = "ch5.intro_two_var";
  const sourceSection = "5.1";
  const problems: Problem[] = [];

  for (let i = 0; i < 50; i++) {
    let problem: Problem;
    const type = i % 5;

    if (difficulty === "easy") {
      if (type === 0) {
        // Given x, find y in ax + by = c
        const a = rng.randInt(1, 6);
        const b = rng.randInt(2, 6);
        const x = rng.randInt(-5, 5);
        const y = rng.randInt(-5, 5);
        const c = a * x + b * y;
        const k = rng.choice([-1, 1]);
        const askX = x + k * b;
        const answerY = y - a * k;
        const prompt = `If $x = ${askX}$, find $y$ in the equation $${linearExpr(a, b)} = ${c}$.`;
        const correct = String(answerY);
        const dist = [String(answerY + 1), String(answerY - 1), String(Math.floor(c / b))];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `Substitute $x = ${askX}$: $${a * askX} + ${b}y = ${c}$, so $${b}y = ${c - a * askX}$ and $y = ${answerY}$.`,
          0.85,
          sourceSection,
          ["two_variable", "linear_equations"]
        );
      } else if (type === 1) {
        // Which ordered pair is a solution
        const a = rng.randInt(1, 5);
        const b = rng.randInt(1, 5);
        const x = rng.randInt(-4, 4);
        const y = rng.randInt(-4, 4);
        const c = a * x + b * y;
        const correctPair = formatOrderedPair(x, y);
        const dist = [
          formatOrderedPair(x + 1, y),
          formatOrderedPair(x, y + 1),
          formatOrderedPair(-x, y),
        ];
        const prompt = `Which ordered pair is a solution to $${linearExpr(a, b)} = ${c}$?`;
        const { choices, correctChoiceId } = makeChoices(correctPair, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "ordered_pair",
          correctPair,
          choices,
          correctChoiceId,
          `Substituting $(${x},${y})$ gives $${a * x} + ${b * y} = ${c}$, which is true.`,
          0.85,
          sourceSection,
          ["two_variable", "solution"]
        );
      } else if (type === 2) {
        // x-intercept
        const a = rng.randInt(1, 6);
        const b = rng.randInt(1, 6);
        const x = rng.randInt(-6, 6);
        const c = a * x;
        const correctPair = formatOrderedPair(x, 0);
        const dist = [formatOrderedPair(0, x), formatOrderedPair(-x, 0), formatOrderedPair(x, 1)];
        const prompt = `Find the $x$-intercept of $${linearExpr(a, b)} = ${c}$.`;
        const { choices, correctChoiceId } = makeChoices(correctPair, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "ordered_pair",
          correctPair,
          choices,
          correctChoiceId,
          `Set $y = 0$: $${a}x = ${c}$, so $x = ${x}$. The $x$-intercept is $(${x},0)$.`,
          0.85,
          sourceSection,
          ["two_variable", "intercepts"]
        );
      } else if (type === 3) {
        // y-intercept
        const a = rng.randInt(1, 6);
        const b = rng.randInt(1, 6);
        const y = rng.randInt(-6, 6);
        const c = b * y;
        const correctPair = formatOrderedPair(0, y);
        const dist = [formatOrderedPair(y, 0), formatOrderedPair(0, -y), formatOrderedPair(1, y)];
        const prompt = `Find the $y$-intercept of $${linearExpr(a, b)} = ${c}$.`;
        const { choices, correctChoiceId } = makeChoices(correctPair, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "ordered_pair",
          correctPair,
          choices,
          correctChoiceId,
          `Set $x = 0$: $${b}y = ${c}$, so $y = ${y}$. The $y$-intercept is $(0,${y})$.`,
          0.85,
          sourceSection,
          ["two_variable", "intercepts"]
        );
      } else {
        // Rewrite as y = mx + b, find slope
        const a = rng.randInt(1, 6);
        const b = rng.randInt(1, 6);
        const c = rng.randInt(1, 12);
        const mNum = -a;
        const mDen = b;
        const correct = fracString(mNum, mDen);
        const dist = [fracString(a, b), fracString(-c, b), fracString(a, c)];
        const prompt = `Rewrite $${linearExpr(a, b)} = ${c}$ in the form $y = mx + b$. What is $m$?`;
        const { choices, correctChoiceId } = makeChoices(fracLatex(mNum, mDen), dist.map((f) => {
          const [n, d] = f.split("/").map(Number);
          return fracLatex(n, d);
        }), rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "fraction",
          correct,
          choices,
          correctChoiceId,
          `Solving for $y$: $${b}y = ${-a}x + ${c}$, so $y = ${fracLatex(-a, b)}x + ${fracLatex(c, b)}$. The slope is $${fracLatex(-a, b)}$.`,
          0.95,
          sourceSection,
          ["two_variable", "slope_intercept"]
        );
      }
    } else if (difficulty === "medium") {
      if (type === 0) {
        // Find k so that (a,b) is a solution
        const a = rng.randInt(1, 6);
        const b = rng.randInt(1, 6);
        const x = rng.randInt(-4, 4);
        const y = rng.randInt(-4, 4);
        const k = a * x + b * y;
        const prompt = `Find $k$ so that $(${x},${y})$ is a solution to $${linearExpr(a, b)} = k$.`;
        const correct = String(k);
        const dist = [String(k + a), String(k - a), String(a * x - b * y)];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `Substitute: $${a}(${x}) + ${b}(${y}) = ${a * x} + ${b * y} = ${k}$.`,
          1.0,
          sourceSection,
          ["two_variable", "parameter"]
        );
      } else if (type === 1) {
        // Find slope through two points
        const x1 = rng.randInt(-5, 5);
        const y1 = rng.randInt(-5, 5);
        let x2 = x1;
        while (x2 === x1) x2 = rng.randInt(-5, 5);
        const y2 = rng.randInt(-5, 5);
        const rise = y2 - y1;
        const run = x2 - x1;
        const correct = fracString(rise, run);
        const dist = [fracString(run, rise), fracString(-rise, run), fracString(rise + run, run)];
        const prompt = `What is the slope of the line through $(${x1},${y1})$ and $(${x2},${y2})$?`;
        const { choices, correctChoiceId } = makeChoices(fracLatex(rise, run), dist.map((f) => {
          const [n, d] = f.split("/").map(Number);
          return fracLatex(n, d);
        }), rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "fraction",
          correct,
          choices,
          correctChoiceId,
          `Slope $= \\dfrac{${y2} - ${y1}}{${x2} - ${x1}} = \\dfrac{${rise}}{${run}} = ${fracLatex(rise, run)}$.`,
          1.0,
          sourceSection,
          ["two_variable", "slope"]
        );
      } else if (type === 2) {
        // Line passes through (a,b); find missing coefficient p in px + qy = r
        const p = rng.randInt(1, 6);
        const q = rng.randInt(1, 6);
        const x = rng.randInt(-4, 4);
        const y = rng.randInt(-4, 4);
        const r = p * x + q * y;
        const prompt = `The line $${linearExpr(p, q, "px", "y")} = ${r}$ passes through $(${x},${y})$. Find $p$.`;
        const correct = String(p);
        const dist = [String(q), String(r - q * y), String(Math.abs(x) === 1 ? r - q * y : Math.floor(r / x))];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `Substitute $(${x},${y})$: $p(${x}) + ${q}(${y}) = ${r}$, so $${x}p = ${r - q * y}$ and $p = ${p}$.`,
          1.05,
          sourceSection,
          ["two_variable", "parameter"]
        );
      } else if (type === 3) {
        // a + b given (a,b) on line and a is known
        const a = rng.randInt(1, 6);
        const b = rng.randInt(1, 6);
        const x = rng.randInt(-4, 4);
        const y = rng.randInt(-4, 4);
        const c = a * x + b * y;
        const prompt = `The point $(${x},y)$ lies on $${linearExpr(a, b)} = ${c}$. Find $x + y$ when $x = ${x}$.`;
        const correct = String(x + y);
        const dist = [String(x - y), String(c - x), String(a * x + b)];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `Substitute $x = ${x}$: $${a * x} + ${b}y = ${c}$, so $y = ${y}$ and $x + y = ${x + y}$.`,
          1.0,
          sourceSection,
          ["two_variable", "evaluation"]
        );
      } else {
        // y-intercept as a value
        const a = rng.randInt(2, 8);
        const b = rng.randInt(2, 8);
        const c = rng.randInt(1, 20);
        const yInt = c / b;
        const correct = fracString(c, b);
        const dist = [fracString(-c, b), fracString(c, a), fracString(a, b)];
        const prompt = `What is the $y$-intercept of $${linearExpr(a, b)} = ${c}$? (Give the $y$-coordinate.)`;
        const { choices, correctChoiceId } = makeChoices(fracLatex(c, b), dist.map((f) => {
          const [n, d] = f.split("/").map(Number);
          return fracLatex(n, d);
        }), rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "fraction",
          correct,
          choices,
          correctChoiceId,
          `Set $x = 0$, then $${b}y = ${c}$, so $y = ${fracLatex(c, b)}$.`,
          1.0,
          sourceSection,
          ["two_variable", "intercepts"]
        );
      }
    } else {
      // Hard
      if (type === 0) {
        // Positive integer solutions count
        const a = rng.randInt(2, 5);
        const b = rng.randInt(2, 5);
        const maxT = rng.randInt(3, 6);
        const c = a * b * maxT;
        let count = 0;
        for (let x = 1; a * x < c; x++) {
          const rem = c - a * x;
          if (rem > 0 && rem % b === 0) count++;
        }
        const correct = String(count);
        const dist = [String(count + 1), String(count - 1), String(Math.floor(c / Math.max(a, b)))];
        const prompt = `How many ordered pairs of positive integers $(x,y)$ satisfy $${a}x + ${b}y = ${c}$?`;
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `For each positive $x$ with $${a}x < ${c}$, check whether $${c} - ${a}x$ is a positive multiple of ${b}. There are ${count}$ such pairs.`,
          1.35,
          sourceSection,
          ["two_variable", "diophantine"]
        );
      } else if (type === 1) {
        // Find k such that (k, mk + b) lies on line
        const a = rng.randInt(1, 4);
        const b = rng.randInt(1, 4);
        const c = rng.randInt(1, 20);
        const m = rng.randInt(2, 4);
        const d = rng.randInt(-3, 3);
        // a*k + b*(m*k + d) = c
        const A = a + b * m;
        const B = b * d;
        const kNum = c - B;
        const kDen = A;
        const correct = fracString(kNum, kDen);
        const kVal = kNum / kDen;
        const dist = [fracString(c - B, a), fracString(c, A), fracString(kNum + 1, kDen)];
        const prompt = `Find $k$ such that the point $(k, ${m}k ${signed(d)})$ lies on $${linearExpr(a, b)} = ${c}$.`;
        const { choices, correctChoiceId } = makeChoices(fracLatex(kNum, kDen), dist.map((f) => {
          const [n, d_] = f.split("/").map(Number);
          return fracLatex(n, d_);
        }), rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "fraction",
          correct,
          choices,
          correctChoiceId,
          `Substitute: $${a}k + ${b}(${m}k ${signed(d)}) = ${c}$, so $${A}k ${signed(B)} = ${c}$, giving $k = ${fracLatex(kNum, kDen)}$.`,
          1.4,
          sourceSection,
          ["two_variable", "parameter"]
        );
      } else if (type === 2) {
        // a^2 + b^2 where (a,b) is x-intercept
        const a = rng.randInt(2, 6);
        const b = rng.randInt(1, 6);
        const x = rng.randInt(-5, 5);
        const c = a * x;
        const sumSq = x * x;
        const correct = String(sumSq);
        const dist = [String(Math.abs(x)), String(x * x + 1), String(a * a)];
        const prompt = `Let $(a,b)$ be the $x$-intercept of $${linearExpr(a, b)} = ${c}$. Find $a^2 + b^2$.`;
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `The $x$-intercept is $(${x},0)$, so $a^2 + b^2 = ${x}^2 + 0^2 = ${sumSq}$.`,
          1.25,
          sourceSection,
          ["two_variable", "intercepts"]
        );
      } else if (type === 3) {
        // Find equation given intercepts as ordered pairs
        const xInt = rng.randInt(2, 6);
        const yInt = rng.randInt(2, 6);
        const c = xInt * yInt;
        const a = yInt;
        const b = xInt;
        const correct = `${a}x + ${b}y = ${c}`;
        const dist = [
          `${a}x + ${b}y = ${a + b}`,
          `${xInt}x + ${yInt}y = ${c}`,
          `${a}x - ${b}y = ${c}`,
        ];
        const prompt = `Find an equation of the line with $x$-intercept $(${xInt},0)$ and $y$-intercept $(0,${yInt})$.`;
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "expression",
          correct,
          choices,
          correctChoiceId,
          `Using $\\dfrac{x}{${xInt}} + \\dfrac{y}{${yInt}} = 1$ and clearing denominators gives $${a}x + ${b}y = ${c}$.`,
          1.3,
          sourceSection,
          ["two_variable", "intercepts"]
        );
      } else {
        // Value of ax + by at another point given two points on line
        const x1 = rng.randInt(-4, 4);
        const y1 = rng.randInt(-4, 4);
        let x2 = x1;
        while (x2 === x1) x2 = rng.randInt(-4, 4);
        const y2 = rng.randInt(-4, 4);
        const x3 = rng.randInt(-4, 4);
        const y3 = rng.randInt(-4, 4);
        // value = a*x3 + b*y3 where line through (x1,y1),(x2,y2)
        // Actually we want: find c such that ax+by=c for (x3,y3)
        // Use line equation: (y2-y1)(x-x1) - (x2-x1)(y-y1) = 0
        const A = y2 - y1;
        const B = x1 - x2;
        const C = A * x1 + B * y1;
        const value = A * x3 + B * y3;
        const correct = String(value);
        const dist = [String(C), String(value + 1), String(A + B)];
        const prompt = `The points $(${x1},${y1})$ and $(${x2},${y2})$ lie on a line. If $(x,y)$ also lies on this line, what value does $${linearExpr(A, B)}$ take at $(${x3},${y3})$?`;
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `For any point on this line, $${linearExpr(A, B)} = ${C}$. At $(${x3},${y3})$ the value is $${value}$.`,
          1.35,
          sourceSection,
          ["two_variable", "line_equation"]
        );
      }
    }
    problems.push(problem);
  }
  for (const p of problems) fixDistractors(p, rng);
  return problems;
}

function generateSubstitution(difficulty: Difficulty, rng: SeededRandom): Problem[] {
  const topicId = "ch5.substitution";
  const sourceSection = "5.2";
  const problems: Problem[] = [];

  for (let i = 0; i < 50; i++) {
    let problem: Problem;
    const type = i % 4;

    if (difficulty === "easy") {
      // y = ax + b; cx + dy = e
      const a = rng.randInt(-5, 5);
      const b = rng.randInt(-10, 10);
      const c = rng.randInt(1, 6);
      const d = rng.randInt(1, 6);
      const x = rng.randInt(-5, 5);
      const y = a * x + b;
      const e = c * x + d * y;
      const correct = formatOrderedPair(x, y);
      const dist = [
        formatOrderedPair(x + 1, y),
        formatOrderedPair(x, a * (x + 1) + b),
        formatOrderedPair(-x, y),
      ];
      const prompt = `Solve $\\begin{cases} y = ${signedTerm(a, "x")} ${signed(b)} \\\\ ${c}x + ${d}y = ${e} \\end{cases}$.`;
      const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
      problem = makeProblem(
        topicId,
        difficulty,
        i,
        prompt,
        "ordered_pair",
        correct,
        choices,
        correctChoiceId,
        `Substitute $y$: $${c}x + ${d}(${signedTerm(a, "x")} ${signed(b)}) = ${e}$, so $x = ${x}$ and $y = ${y}$.`,
        0.9,
        sourceSection,
        ["substitution", "systems"]
      );
    } else if (difficulty === "medium") {
      if (type < 2) {
        // Need to isolate one variable first
        const a = rng.randInt(2, 6);
        const b = rng.randInt(1, 6);
        const c = rng.randInt(1, 20);
        const d = rng.randInt(2, 6);
        const e = rng.randInt(1, 6);
        const f = rng.randInt(1, 30);
        const x = rng.randInt(-5, 5);
        const y = (c - a * x) / b;
        // Ensure second equation holds
        const lhs2 = d * x + e * y;
        // We need f = lhs2; adjust f
        const adjustedF = lhs2;
        const prompt = `Solve $\\begin{cases} ${a}x + ${b}y = ${c} \\\\ ${d}x + ${e}y = ${adjustedF} \\end{cases}$.`;
        const correct = formatOrderedPair(x, y);
        const dist = [
          formatOrderedPair(x + 1, Math.round((c - a * (x + 1)) / b)),
          formatOrderedPair(Math.round((adjustedF - e * y) / d), y),
          formatOrderedPair(x, y + 1),
        ];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "string",
          correct,
          choices,
          correctChoiceId,
          `From the first equation, $y = ${fracLatex(c - a * x, b)}$. Substitute into the second to get $x = ${x}$, so $y = ${y}$.`,
          1.05,
          sourceSection,
          ["substitution", "systems"]
        );
      } else {
        // One equation has parentheses
        const a = rng.randInt(1, 4);
        const b = rng.randInt(1, 4);
        const x = rng.randInt(-4, 4);
        const y = rng.randInt(-4, 4);
        const c = a * (x + b * y);
        const d = rng.randInt(1, 6);
        const e = rng.randInt(1, 6);
        const f = d * x + e * y;
        const prompt = `Solve $\\begin{cases} ${a}(x ${signed(b)}y) = ${c} \\\\ ${d}x + ${e}y = ${f} \\end{cases}$.`;
        const correct = formatOrderedPair(x, y);
        const dist = [
          formatOrderedPair(x + 1, y),
          formatOrderedPair(x, Math.round((c / a - x) / b)),
          formatOrderedPair(Math.round((f - e * y) / d), y),
        ];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "string",
          correct,
          choices,
          correctChoiceId,
          `Divide the first equation by ${a}, isolate $x$, substitute into the second, and solve to get $(${x},${y})$.`,
          1.1,
          sourceSection,
          ["substitution", "parentheses"]
        );
      }
    } else {
      // Hard
      if (type < 2) {
        // Larger coefficients / negative
        const a = rng.randInt(3, 9);
        const b = rng.randInt(2, 9);
        const x = rng.randInt(-6, 6);
        const y = rng.randInt(-6, 6);
        const c = a * x + b * y;
        const d = rng.randInt(3, 9);
        const e = rng.randInt(2, 9);
        const f = d * x + e * y;
        const prompt = `Solve $\\begin{cases} ${a}x ${signed(-b)}y = ${c} \\\\ ${d}x + ${e}y = ${f} \\end{cases}$.`;
        const correct = formatOrderedPair(x, y);
        const dist = [
          formatOrderedPair(x, -y),
          formatOrderedPair(x + 1, Math.round((c - a * (x + 1)) / b)),
          formatOrderedPair(Math.round((f - e * y) / d), y),
        ];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "string",
          correct,
          choices,
          correctChoiceId,
          `Isolate $x$ from the first equation and substitute into the second. After simplifying, $x = ${x}$ and $y = ${y}$.`,
          1.25,
          sourceSection,
          ["substitution", "systems"]
        );
      } else if (type === 2) {
        // No solution / infinite solutions
        const x = rng.randInt(2, 5);
        const y = rng.randInt(2, 5);
        const a = rng.randInt(1, 4);
        const b = rng.randInt(1, 4);
        const c = a * x + b * y;
        const k = rng.randInt(2, 4);
        const d = k * a;
        const e = k * b;
        const infinite = rng.next() > 0.5;
        const f = infinite ? k * c : k * c + rng.randInt(1, 3);
        const prompt = `How many solutions does the system $\\begin{cases} ${a}x + ${b}y = ${c} \\\\ ${d}x + ${e}y = ${f} \\end{cases}$ have?`;
        const correct = infinite ? "infinitely many" : "0";
        const dist = infinite ? ["0", "1", "2"] : ["1", "2", "infinitely many"];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "string",
          correct,
          choices,
          correctChoiceId,
          infinite
            ? `The second equation is ${k} times the first, so the equations describe the same line.`
            : `The left side of the second equation is ${k} times the first, but the right side is not, so the lines are parallel and distinct.`,
          1.35,
          sourceSection,
          ["substitution", "systems", "special"]
        );
      } else {
        // Reciprocal substitution (linear in 1/x, 1/y)
        const x = rng.randInt(2, 5);
        const y = rng.randInt(2, 5);
        const u = 1 / x;
        const v = 1 / y;
        const a = rng.randInt(1, 3);
        const b = rng.randInt(1, 3);
        const c = rng.randInt(1, 3);
        const d = rng.randInt(1, 3);
        const e = a * u + b * v;
        const f = c * u - d * v;
        const prompt = `Solve $\\begin{cases} \\dfrac{${a}}{x} + \\dfrac{${b}}{y} = ${fracLatex(e * 1, 1).replace(/\\dfrac\{(-?\d+)\}\{1\}/, "$1")} \\\\ \\dfrac{${c}}{x} - \\dfrac{${d}}{y} = ${String(f)} \\end{cases}$.`;
        const correct = formatOrderedPair(x, y);
        const dist = [
          formatOrderedPair(Math.round(1 / u), Math.round(1 / (v + 0.1))),
          formatOrderedPair(x + 1, y),
          formatOrderedPair(y, x),
        ];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "string",
          correct,
          choices,
          correctChoiceId,
          `Let $u = 1/x$ and $v = 1/y$. Solve the linear system for $u$ and $v$, then invert to find $(x,y) = (${x},${y})$.`,
          1.45,
          sourceSection,
          ["substitution", "reciprocal", "systems"]
        );
      }
    }
    problems.push(problem);
  }
  for (const p of problems) fixDistractors(p, rng);
  return problems;
}

function generateElimination(difficulty: Difficulty, rng: SeededRandom): Problem[] {
  const topicId = "ch5.elimination";
  const sourceSection = "5.3";
  const problems: Problem[] = [];

  for (let i = 0; i < 50; i++) {
    let problem: Problem;
    const type = i % 4;

    if (difficulty === "easy") {
      if (type < 2) {
        // Coefficients already match for one variable
        const a = rng.randInt(1, 6);
        const b1 = rng.randInt(1, 6);
        const b2 = b1;
        const x = rng.randInt(-5, 5);
        const y = rng.randInt(-5, 5);
        const c1 = a * x + b1 * y;
        const d = rng.randInt(1, 6);
        const c2 = d * x + b2 * y;
        const op = rng.next() > 0.5 ? "subtract" : "add";
        const prompt = `Solve $\\begin{cases} ${a}x + ${b1}y = ${c1} \\\\ ${d}x ${op === "subtract" ? "+" : "-"} ${b2}y = ${op === "subtract" ? c2 : c2} \\end{cases}$.`;
        const correct = formatOrderedPair(x, y);
        const dist = [
          formatOrderedPair(x + 1, y),
          formatOrderedPair(x, y + 1),
          formatOrderedPair(-x, y),
        ];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "string",
          correct,
          choices,
          correctChoiceId,
          `The $y$ terms ${op === "subtract" ? "subtract" : "add"} away, leaving $x = ${x}$. Then $y = ${y}$.`,
          0.9,
          sourceSection,
          ["elimination", "systems"]
        );
      } else {
        // Multiply one equation
        const a = rng.randInt(1, 4);
        const b = rng.randInt(1, 4);
        const x = rng.randInt(-4, 4);
        const y = rng.randInt(-4, 4);
        const c1 = a * x + b * y;
        const k = rng.randInt(2, 4);
        const d = k * a;
        const e = rng.randInt(1, 4);
        const c2 = d * x + e * y;
        const prompt = `Solve $\\begin{cases} ${a}x + ${b}y = ${c1} \\\\ ${d}x + ${e}y = ${c2} \\end{cases}$.`;
        const correct = formatOrderedPair(x, y);
        const dist = [
          formatOrderedPair(x, Math.round((c1 - a * x) / b) + 1),
          formatOrderedPair(Math.round((c2 - e * y) / d) + 1, y),
          formatOrderedPair(-x, y),
        ];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "string",
          correct,
          choices,
          correctChoiceId,
          `Multiply the first equation by ${k} and subtract to eliminate $x$, giving $y = ${y}$ and then $x = ${x}$.`,
          0.95,
          sourceSection,
          ["elimination", "systems"]
        );
      }
    } else if (difficulty === "medium") {
      if (type < 2) {
        // Multiply both equations
        const x = rng.randInt(-4, 4);
        const y = rng.randInt(-4, 4);
        const a = rng.randInt(2, 5);
        const b = rng.randInt(2, 5);
        const c = rng.randInt(2, 5);
        const d = rng.randInt(2, 5);
        const c1 = a * x + b * y;
        const c2 = c * x + d * y;
        const prompt = `Solve $\\begin{cases} ${a}x + ${b}y = ${c1} \\\\ ${c}x + ${d}y = ${c2} \\end{cases}$.`;
        const correct = formatOrderedPair(x, y);
        const dist = [
          formatOrderedPair(x + 1, y),
          formatOrderedPair(x, y + 1),
          formatOrderedPair(-x, -y),
        ];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "string",
          correct,
          choices,
          correctChoiceId,
          `Multiply to align coefficients, eliminate one variable, solve, then back-substitute to get $(x,y) = (${x},${y})$.`,
          1.1,
          sourceSection,
          ["elimination", "systems"]
        );
      } else if (type === 2) {
        // Need to rearrange to standard form
        const x = rng.randInt(-4, 4);
        const y = rng.randInt(-4, 4);
        const a = rng.randInt(1, 5);
        const b = rng.randInt(1, 5);
        const c = rng.randInt(1, 5);
        const c1 = a * x + b * y;
        const c2 = c * x - b * y;
        const prompt = `Solve $\\begin{cases} ${a}x = ${c1} - ${b}y \\\\ ${c}x - ${b}y = ${c2} \\end{cases}$.`;
        const correct = formatOrderedPair(x, y);
        const dist = [
          formatOrderedPair(x + 1, y),
          formatOrderedPair(x, y + 1),
          formatOrderedPair(-x, y),
        ];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "string",
          correct,
          choices,
          correctChoiceId,
          `Rewrite the first equation as $${a}x + ${b}y = ${c1}$, then add the equations to eliminate $y$.`,
          1.1,
          sourceSection,
          ["elimination", "rearrange"]
        );
      } else {
        // Fraction coefficients
        const x = rng.randInt(-4, 4);
        const y = rng.randInt(-4, 4);
        const a = rng.randInt(2, 4);
        const b = rng.randInt(2, 4);
        const c1Num = a * x + b * y;
        const c2Num = a * x - b * y;
        const prompt = `Solve $\\begin{cases} \\dfrac{x}{${b}} + \\dfrac{y}{${a}} = ${fracLatex(c1Num, a * b)} \\\\ \\dfrac{x}{${b}} - \\dfrac{y}{${a}} = ${fracLatex(c2Num, a * b)} \\end{cases}$.`;
        const correct = formatOrderedPair(x, y);
        const dist = [
          formatOrderedPair(x + 1, y),
          formatOrderedPair(x, y + 1),
          formatOrderedPair(-x, y),
        ];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "string",
          correct,
          choices,
          correctChoiceId,
          `Multiply each equation by $${a * b}$ to clear fractions, then add and subtract to find $x = ${x}$ and $y = ${y}$.`,
          1.2,
          sourceSection,
          ["elimination", "fractions"]
        );
      }
    } else {
      // Hard
      if (type < 2) {
        // Larger coefficients, both multiply
        const x = rng.randInt(-5, 5);
        const y = rng.randInt(-5, 5);
        const a = rng.randInt(3, 7);
        const b = rng.randInt(2, 7);
        const c = rng.randInt(3, 7);
        const d = rng.randInt(2, 7);
        const c1 = a * x + b * y;
        const c2 = c * x - d * y;
        const prompt = `Solve $\\begin{cases} ${a}x + ${b}y = ${c1} \\\\ ${c}x - ${d}y = ${c2} \\end{cases}$.`;
        const correct = formatOrderedPair(x, y);
        const dist = [
          formatOrderedPair(x, -y),
          formatOrderedPair(x + 1, Math.round((c1 - a * (x + 1)) / b)),
          formatOrderedPair(Math.round((c2 + d * y) / c), y),
        ];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "string",
          correct,
          choices,
          correctChoiceId,
          `Eliminate $y$ by multiplying the first equation by ${d} and the second by ${b}, then solve for $x$ and back-substitute.`,
          1.3,
          sourceSection,
          ["elimination", "systems"]
        );
      } else if (type === 2) {
        // No solution / infinite solutions
        const a = rng.randInt(2, 5);
        const b = rng.randInt(2, 5);
        const x = rng.randInt(2, 5);
        const y = rng.randInt(2, 5);
        const c = a * x + b * y;
        const k = rng.randInt(2, 4);
        const d = k * a;
        const e = k * b;
        const infinite = rng.next() > 0.5;
        const f = infinite ? k * c : k * c + rng.randInt(1, 4);
        const prompt = `How many solutions does $\\begin{cases} ${a}x + ${b}y = ${c} \\\\ ${d}x + ${e}y = ${f} \\end{cases}$ have?`;
        const correct = infinite ? "infinitely many" : "0";
        const dist = infinite ? ["0", "1", "2"] : ["1", "2", "infinitely many"];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "string",
          correct,
          choices,
          correctChoiceId,
          infinite
            ? `The second equation is a multiple of the first, so the lines coincide.`
            : `The equations have the same left-hand-side ratio but different right-hand sides, so they are parallel.`,
          1.35,
          sourceSection,
          ["elimination", "special"]
        );
      } else {
        // 3 equations but one trivially gives a variable
        const x = rng.randInt(-4, 4);
        const y = rng.randInt(-4, 4);
        const z = rng.randInt(-4, 4);
        const a = rng.randInt(1, 4);
        const b = rng.randInt(1, 4);
        const c1 = a * x + b * y;
        const d = rng.randInt(1, 4);
        const e = rng.randInt(1, 4);
        const c2 = d * x + e * z;
        const prompt = `Solve $\\begin{cases} ${a}x + ${b}y = ${c1} \\\\ ${d}x + ${e}z = ${c2} \\\\ y - z = ${y - z} \\end{cases}$.`;
        const correct = formatOrderedPair3(x, y, z);
        const dist = [
          formatOrderedPair3(x + 1, y, z),
          formatOrderedPair3(x, y + 1, z),
          formatOrderedPair3(x, y, z + 1),
        ];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "string",
          correct,
          choices,
          correctChoiceId,
          `From $y - z = ${y - z}$, express $y$ in terms of $z$, then use the other two equations to find $x = ${x}$ and $z = ${z}$.`,
          1.45,
          sourceSection,
          ["elimination", "three_variables"]
        );
      }
    }
    problems.push(problem);
  }
  for (const p of problems) fixDistractors(p, rng);
  return problems;
}

function generateWordProblems(difficulty: Difficulty, rng: SeededRandom): Problem[] {
  const topicId = "ch5.word_problems";
  const sourceSection = "5.4";
  const problems: Problem[] = [];

  for (let i = 0; i < 50; i++) {
    let problem: Problem;
    const type = i % 5;

    if (difficulty === "easy") {
      if (type === 0) {
        // Two numbers sum and difference
        const larger = rng.randInt(10, 50);
        const diff = rng.randInt(2, 12);
        const smaller = larger - diff;
        const sum = larger + smaller;
        const prompt = `The sum of two numbers is $${sum}$ and their difference is $${diff}$. What is the larger number?`;
        const correct = String(larger);
        const dist = [String(smaller), String(sum), String(diff)];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `Let the numbers be $x$ and $y$. Then $x + y = ${sum}$ and $x - y = ${diff}$. Adding gives $2x = ${sum + diff}$, so the larger number is $${larger}$.`,
          1.0,
          sourceSection,
          ["word_problem", "sum_difference"]
        );
      } else if (type === 1) {
        // Coins
        const d = rng.randInt(3, 15);
        const q = rng.randInt(2, 12);
        const totalCoins = d + q;
        const totalValue = 10 * d + 25 * q;
        const prompt = `Dave has ${totalCoins} coins, all dimes and quarters, worth ${totalValue} cents in total. How many dimes does he have?`;
        const correct = String(d);
        const dist = [String(q), String(totalCoins - d), String(Math.floor(totalValue / 10))];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `Let $d$ be dimes and $q$ be quarters. Then $d + q = ${totalCoins}$ and $10d + 25q = ${totalValue}$. Solving gives $d = ${d}$.`,
          1.05,
          sourceSection,
          ["word_problem", "coins"]
        );
      } else if (type === 2) {
        // Two item purchase
        const a = rng.randInt(2, 8);
        const b = rng.randInt(2, 8);
        const n = rng.randInt(3, 12);
        const m = rng.randInt(2, 10);
        const total = a * n + b * m;
        const prompt = `Apples cost $${a}$ dollars each and bananas cost $${b}$ dollars each. Sarah buys ${n} apples and ${m} bananas. How much does she spend?`;
        const correct = String(total);
        const dist = [String(a * n), String(b * m), String(a + b + n + m)];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `Compute $${a} \\cdot ${n} + ${b} \\cdot ${m} = ${total}$ dollars.`,
          0.9,
          sourceSection,
          ["word_problem", "purchase"]
        );
      } else if (type === 3) {
        // Two numbers, one is multiple of other
        const y = rng.randInt(2, 10);
        const k = rng.randInt(2, 5);
        const x = k * y;
        const sum = x + y;
        const prompt = `One number is ${k} times another. Their sum is ${sum}. What is the smaller number?`;
        const correct = String(y);
        const dist = [String(x), String(sum), String(k)];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `Let the smaller number be $y$. Then $${k}y + y = ${sum}$, so $y = ${y}$.`,
          0.95,
          sourceSection,
          ["word_problem", "numbers"]
        );
      } else {
        // Simple total
        const a = rng.randInt(2, 8);
        const b = rng.randInt(2, 8);
        const x = rng.randInt(3, 12);
        const y = rng.randInt(2, 10);
        const t1 = a * x;
        const t2 = b * y;
        const prompt = `There are ${x} groups of ${a} students and ${y} groups of ${b} students. How many students are there in total?`;
        const correct = String(t1 + t2);
        const dist = [String(t1), String(t2), String(a * b + x * y)];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `Total students $= ${a} \\cdot ${x} + ${b} \\cdot ${y} = ${t1 + t2}$.`,
          0.9,
          sourceSection,
          ["word_problem", "total"]
        );
      }
    } else if (difficulty === "medium") {
      if (type === 0) {
        // Tickets
        const adultPrice = rng.randInt(8, 15);
        const childPrice = rng.randInt(4, 8);
        const adultCount = rng.randInt(10, 40);
        const childCount = rng.randInt(10, 40);
        const total = adultPrice * adultCount + childPrice * childCount;
        const totalCount = adultCount + childCount;
        const prompt = `A theater sells ${totalCount} tickets for $${total}$ total. Adult tickets cost $${adultPrice}$ and child tickets cost $${childPrice}$. How many adult tickets were sold?`;
        const correct = String(adultCount);
        const dist = [String(childCount), String(totalCount - adultCount), String(Math.floor(total / adultPrice))];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `Let $a$ and $c$ be adult and child tickets. Then $a + c = ${totalCount}$ and $${adultPrice}a + ${childPrice}c = ${total}$. Solving gives $a = ${adultCount}$.`,
          1.1,
          sourceSection,
          ["word_problem", "tickets"]
        );
      } else if (type === 1) {
        // Mixture
        let nutsPrice: number, raisinsPrice: number, mixPrice: number, totalWeight: number, n: number, r: number;
        do {
          nutsPrice = rng.randInt(3, 6);
          raisinsPrice = rng.randInt(1, 3);
          mixPrice = rng.randInt(raisinsPrice + 1, nutsPrice - 1);
          totalWeight = rng.randInt(10, 30);
          const nNum = (mixPrice - raisinsPrice) * totalWeight;
          const nDen = nutsPrice - raisinsPrice;
          n = nNum / nDen;
          r = totalWeight - n;
        } while (!Number.isInteger(n) || n <= 0 || r <= 0);
        const prompt = `A snack mix costs $${mixPrice}$ dollars per pound. It is made by mixing nuts at $${nutsPrice}$ dollars per pound with raisins at $${raisinsPrice}$ dollars per pound. How many pounds of nuts are in ${totalWeight} pounds of mix?`;
        const correct = String(n);
        const dist = [String(r), String(totalWeight - n), String(Math.ceil(totalWeight / 2))];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `Let $n$ and $r$ be pounds of nuts and raisins. Then $n + r = ${totalWeight}$ and $${nutsPrice}n + ${raisinsPrice}r = ${mixPrice * totalWeight}$. Solving gives $n = ${n}$.`,
          1.15,
          sourceSection,
          ["word_problem", "mixture"]
        );
      } else if (type === 2) {
        // Age
        let ageDiff: number, sumNow: number, older: number, younger: number;
        do {
          ageDiff = rng.randInt(5, 15);
          sumNow = rng.randInt(30, 60);
          older = (sumNow + ageDiff) / 2;
          younger = sumNow - older;
        } while (!Number.isInteger(older) || older <= 0 || younger <= 0);
        const prompt = `A mother is ${ageDiff} years older than her daughter. The sum of their ages is ${sumNow}. How old is the daughter?`;
        const correct = String(younger);
        const dist = [String(older), String(sumNow), String(ageDiff)];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `Let $m$ and $d$ be their ages. Then $m = d + ${ageDiff}$ and $m + d = ${sumNow}$. Substituting gives $d = ${younger}$.`,
          1.05,
          sourceSection,
          ["word_problem", "age"]
        );
      } else if (type === 3) {
        // Two-digit number
        const tens = rng.randInt(2, 8);
        const ones = rng.randInt(1, 9);
        const sumDigits = tens + ones;
        const number = 10 * tens + ones;
        const reversed = 10 * ones + tens;
        const diff = Math.abs(number - reversed);
        const prompt = `A two-digit number has digits that sum to ${sumDigits}. The number minus its reverse is ${number > reversed ? "" : "-"}${diff}. What is the number?`;
        const correct = String(number);
        const dist = [String(reversed), String(10 * sumDigits), String(tens * ones)];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `Let the number be $10t + u$. Then $t + u = ${sumDigits}$ and $9t - 9u = ${number - reversed}$, so $t = ${tens}$ and $u = ${ones}$.`,
          1.15,
          sourceSection,
          ["word_problem", "digits"]
        );
      } else {
        // Distance / speed two parts
        const speed1 = rng.randInt(30, 60);
        const speed2 = rng.randInt(30, 60);
        const time1 = rng.randInt(1, 3);
        const time2 = rng.randInt(1, 3);
        const dist1 = speed1 * time1;
        const dist2 = speed2 * time2;
        const prompt = `A car travels at ${speed1} mph for ${time1} hours, then at ${speed2} mph for ${time2} hours. How many total miles does it travel?`;
        const correct = String(dist1 + dist2);
        const dist = [String(dist1), String(dist2), String(speed1 + speed2)];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `Distance is rate times time: $${speed1} \\cdot ${time1} + ${speed2} \\cdot ${time2} = ${dist1 + dist2}$ miles.`,
          1.0,
          sourceSection,
          ["word_problem", "distance"]
        );
      }
    } else {
      // Hard
      if (type === 0) {
        // Mixture with percentages
        let acidA: number, acidB: number, targetAcid: number, totalVolume: number, aVol: number, bVol: number;
        do {
          acidA = rng.randInt(10, 30);
          acidB = rng.randInt(40, 70);
          targetAcid = rng.randInt(acidA + 5, acidB - 5);
          totalVolume = rng.randInt(20, 50);
          const aNum = (targetAcid - acidB) * totalVolume;
          const aDen = acidA - acidB;
          aVol = aNum / aDen;
          bVol = totalVolume - aVol;
        } while (!Number.isInteger(aVol) || aVol <= 0 || bVol <= 0);
        const prompt = `Chemist A has a $${acidA}\\%$ acid solution and chemist B has a $${acidB}\\%$ acid solution. How many liters of A must be mixed with the rest from B to make ${totalVolume} liters of a $${targetAcid}\\%$ solution?`;
        const correct = String(aVol);
        const dist = [String(bVol), String(Math.floor(totalVolume / 2)), String(Math.floor(totalVolume * targetAcid / 100))];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `Let $a$ and $b$ be the liters from A and B. Then $a + b = ${totalVolume}$ and $${acidA/100}a + ${acidB/100}b = ${targetAcid/100} \\cdot ${totalVolume}$. Solving gives $a = ${aVol}$.`,
          1.4,
          sourceSection,
          ["word_problem", "mixture"]
        );
      } else if (type === 1) {
        // Work / rate
        const rateA = rng.randInt(2, 5); // hours per job
        const rateB = rng.randInt(3, 6);
        const together = (rateA * rateB) / (rateA + rateB);
        const prompt = `Pipe A can fill a tank in ${rateA} hours and pipe B in ${rateB} hours. How many hours does it take both pipes together to fill the tank?`;
        const correct = fracString(rateA * rateB, rateA + rateB);
        const dist = [
          fracString(rateA + rateB, rateA * rateB),
          fracString(rateA + rateB, 2),
          fracString(Math.min(rateA, rateB), 1),
        ];
        const { choices, correctChoiceId } = makeChoices(fracLatex(rateA * rateB, rateA + rateB), dist.map((f) => {
          const [n, d] = f.split("/").map(Number);
          return fracLatex(n, d);
        }), rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "fraction",
          correct,
          choices,
          correctChoiceId,
          `Combined rate is $1/${rateA} + 1/${rateB} = ${fracLatex(rateA + rateB, rateA * rateB)}$ tanks per hour, so time is $${fracLatex(rateA * rateB, rateA + rateB)}$ hours.`,
          1.45,
          sourceSection,
          ["word_problem", "work"]
        );
      } else if (type === 2) {
        // Distance round trip
        const distance = rng.randInt(60, 150);
        const speedThere = rng.randInt(30, 60);
        const speedBack = rng.randInt(30, 60);
        const totalTime = distance / speedThere + distance / speedBack;
        const prompt = `A cyclist rides ${distance} miles at ${speedThere} mph and returns ${distance} miles at ${speedBack} mph. What is the total time of the trip (in hours)?`;
        const correct = fracString(distance * (speedThere + speedBack), speedThere * speedBack);
        const dist = [
          fracString(2 * distance, speedThere + speedBack),
          fracString(distance, speedThere),
          fracString(distance, speedBack),
        ];
        const { choices, correctChoiceId } = makeChoices(fracLatex(distance * (speedThere + speedBack), speedThere * speedBack), dist.map((f) => {
          const [n, d] = f.split("/").map(Number);
          return fracLatex(n, d);
        }), rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "fraction",
          correct,
          choices,
          correctChoiceId,
          `Time there is $${distance}/${speedThere}$ and back is $${distance}/${speedBack}$. Total time is $${fracLatex(distance * (speedThere + speedBack), speedThere * speedBack)}$ hours.`,
          1.4,
          sourceSection,
          ["word_problem", "distance"]
        );
      } else if (type === 3) {
        // Three item total
        const a = rng.randInt(2, 6);
        const b = rng.randInt(2, 6);
        const c = rng.randInt(2, 6);
        const na = rng.randInt(2, 8);
        const nb = rng.randInt(2, 8);
        const nc = rng.randInt(2, 8);
        const total = a * na + b * nb + c * nc;
        const prompt = `A store sells item A for $${a}$, item B for $${b}$, and item C for $${c}$. A customer buys ${na} of A, ${nb} of B, and ${nc} of C. What is the total cost?`;
        const correct = String(total);
        const dist = [String(a * na + b * nb), String(b * nb + c * nc), String(a + b + c + na + nb + nc)];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `Compute $${a} \\cdot ${na} + ${b} \\cdot ${nb} + ${c} \\cdot ${nc} = ${total}$ dollars.`,
          1.1,
          sourceSection,
          ["word_problem", "purchase"]
        );
      } else {
        // Age with future
        let nowDiff: number, futureYears: number, futureSum: number, older: number, younger: number;
        do {
          nowDiff = rng.randInt(10, 20);
          futureYears = rng.randInt(2, 10);
          futureSum = rng.randInt(40, 80);
          older = (futureSum - 2 * futureYears + nowDiff) / 2;
          younger = older - nowDiff;
        } while (!Number.isInteger(older) || older <= 0 || younger <= 0);
        const prompt = `In ${futureYears} years, a father will be ${nowDiff} years older than his son, and the sum of their ages will be ${futureSum}. How old is the son now?`;
        const correct = String(younger);
        const dist = [String(older), String(younger + futureYears), String(Math.floor(futureSum / 2))];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `Let their current ages be $f$ and $s$. In ${futureYears} years, $f - s = ${nowDiff}$ and $(f + ${futureYears}) + (s + ${futureYears}) = ${futureSum}$. Solving gives $s = ${younger}$.`,
          1.35,
          sourceSection,
          ["word_problem", "age"]
        );
      }
    }
    problems.push(problem);
  }
  for (const p of problems) fixDistractors(p, rng);
  return problems;
}

function generateMoreDisguise(difficulty: Difficulty, rng: SeededRandom): Problem[] {
  const topicId = "ch5.more_disguise";
  const sourceSection = "5.5";
  const problems: Problem[] = [];

  for (let i = 0; i < 50; i++) {
    let problem: Problem;
    const type = i % 4;

    if (difficulty === "easy") {
      if (type < 2) {
        // (x + y)/a = b
        const a = rng.randInt(2, 6);
        const sum = rng.randInt(3, 12);
        const b = a * sum;
        const x = rng.randInt(1, sum - 1);
        const y = sum - x;
        const prompt = `If $\\dfrac{x + y}{${a}} = ${b}$ and $x = ${x}$, what is $y$?`;
        const correct = String(y);
        const dist = [String(sum), String(x), String(b)];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `Multiply both sides by ${a}: $x + y = ${b}$. With $x = ${x}$, we get $y = ${y}$.`,
          0.9,
          sourceSection,
          ["disguise", "linear"]
        );
      } else {
        // Distribute first
        const a = rng.randInt(2, 5);
        const b = rng.randInt(1, 5);
        const c = rng.randInt(1, 5);
        const x = rng.randInt(-5, 5);
        const y = rng.randInt(-5, 5);
        const rhs = a * (x + b * y) + c;
        const prompt = `Solve $${a}(x + ${b}y) + ${c} = ${rhs}$ for $y$ when $x = ${x}$.`;
        const correct = String(y);
        const dist = [String(y + 1), String(Math.floor((rhs - c) / a / b)), String(x)];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `Distribute: $${a}x + ${a * b}y + ${c} = ${rhs}$. Substitute $x = ${x}$ and solve for $y$.`,
          0.95,
          sourceSection,
          ["disguise", "distribute"]
        );
      }
    } else if (difficulty === "medium") {
      if (type === 0) {
        // Fractional coefficients
        const x = rng.randInt(2, 6);
        const y = rng.randInt(2, 6);
        const a = rng.randInt(2, 4);
        const b = rng.randInt(2, 4);
        const c1Num = x + a * y;
        const c2Num = b * x - y;
        const prompt = `Solve $\\begin{cases} \\dfrac{x}{${a}} + y = ${fracLatex(c1Num, a)} \\\\ x - \\dfrac{y}{${b}} = ${fracLatex(c2Num, b)} \\end{cases}$.`;
        const correct = formatOrderedPair(x, y);
        const dist = [formatOrderedPair(x + 1, y), formatOrderedPair(x, y + 1), formatOrderedPair(-x, y)];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "string",
          correct,
          choices,
          correctChoiceId,
          `Multiply the first equation by ${a} and the second by ${b} to clear fractions, then eliminate to find $(x,y) = (${x},${y})$.`,
          1.15,
          sourceSection,
          ["disguise", "fractions"]
        );
      } else if (type === 1) {
        // Nested grouping
        const a = rng.randInt(1, 4);
        const b = rng.randInt(1, 4);
        const x = rng.randInt(-4, 4);
        const y = rng.randInt(-4, 4);
        const c = 2 * (a * x + b * y) + 3 * x;
        const prompt = `Solve for $y$: $2(${a}x + ${b}y) + 3x = ${c}$ when $x = ${x}$.`;
        const correct = String(y);
        const dist = [String(y + 1), String(Math.floor((c - 3 * x) / (2 * b))), String(x)];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `Simplify: $${2 * a + 3}x + ${2 * b}y = ${c}$. With $x = ${x}$, solve to get $y = ${y}$.`,
          1.1,
          sourceSection,
          ["disguise", "grouping"]
        );
      } else if (type === 2) {
        // Proportion x/y = a/b with sum
        const ratioA = rng.randInt(2, 5);
        const ratioB = rng.randInt(2, 5);
        const k = rng.randInt(2, 6);
        const x = ratioA * k;
        const y = ratioB * k;
        const sum = x + y;
        const prompt = `The ratio of $x$ to $y$ is $${ratioA}:${ratioB}$ and $x + y = ${sum}$. Find $x$.`;
        const correct = String(x);
        const dist = [String(y), String(sum), String(ratioA + ratioB)];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `Let $x = ${ratioA}k$ and $y = ${ratioB}k$. Then $${ratioA}k + ${ratioB}k = ${sum}$, so $k = ${k}$ and $x = ${x}$.`,
          1.1,
          sourceSection,
          ["disguise", "proportion"]
        );
      } else {
        // ax + by = cx + dy + e
        const x = rng.randInt(-4, 4);
        const y = rng.randInt(-4, 4);
        const a = rng.randInt(2, 5);
        const b = rng.randInt(2, 5);
        const c = rng.randInt(1, 4);
        const d = rng.randInt(1, 4);
        const e = (a - c) * x + (b - d) * y;
        const prompt = `Solve for $x$ in terms of $y$: $${a}x + ${b}y = ${c}x + ${d}y + ${e}$.`;
        const coeff = a - c;
        const constTerm = e - (b - d) * y;
        const answerX = constTerm / coeff;
        const correct = String(answerX);
        const dist = [String(answerX + 1), String(Math.floor(e / coeff)), String(y)];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `Collect $x$ terms: $${coeff}x = ${e - (b - d) * y}$, so $x = ${answerX}$.`,
          1.15,
          sourceSection,
          ["disguise", "collect"]
        );
      }
    } else {
      // Hard
      if (type === 0) {
        // Reciprocal system
        const x = rng.randInt(2, 5);
        const y = rng.randInt(2, 5);
        const a = rng.randInt(1, 3);
        const b = rng.randInt(1, 3);
        const c = rng.randInt(1, 3);
        const d = rng.randInt(1, 3);
        const e = a / x + b / y;
        const f = c / x - d / y;
        const prompt = `Solve $\\begin{cases} \\dfrac{${a}}{x} + \\dfrac{${b}}{y} = ${e} \\\\ \\dfrac{${c}}{x} - \\dfrac{${d}}{y} = ${f} \\end{cases}$.`;
        const correct = formatOrderedPair(x, y);
        const dist = [formatOrderedPair(x + 1, y), formatOrderedPair(x, y + 1), formatOrderedPair(y, x)];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "string",
          correct,
          choices,
          correctChoiceId,
          `Let $u = 1/x$ and $v = 1/y$, solve the linear system, then invert to get $(x,y) = (${x},${y})$.`,
          1.5,
          sourceSection,
          ["disguise", "reciprocal"]
        );
      } else if (type === 1) {
        // Nested fractions
        const x = rng.randInt(2, 6);
        const y = rng.randInt(2, 6);
        const a = rng.randInt(2, 4);
        const b = rng.randInt(2, 4);
        const c1 = (x + y) / a;
        const c2 = (x - y) / b;
        const prompt = `Solve $\\begin{cases} \\dfrac{x + y}{${a}} = ${c1} \\\\ \\dfrac{x - y}{${b}} = ${c2} \\end{cases}$.`;
        const correct = formatOrderedPair(x, y);
        const dist = [formatOrderedPair(x + 1, y), formatOrderedPair(x, y + 1), formatOrderedPair(x, -y)];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "string",
          correct,
          choices,
          correctChoiceId,
          `Multiply to get $x + y = ${a * c1}$ and $x - y = ${b * c2}$, then add and subtract to find $x = ${x}$ and $y = ${y}$.`,
          1.45,
          sourceSection,
          ["disguise", "fractions"]
        );
      } else if (type === 2) {
        // Disguised ratio with difference
        const ratioA = rng.randInt(2, 5);
        const ratioB = rng.randInt(2, 5);
        const k = rng.randInt(2, 6);
        const x = ratioA * k;
        const y = ratioB * k;
        const diff = Math.abs(x - y);
        const prompt = `The ratio of $x$ to $y$ is $${ratioA}:${ratioB}$ and $|x - y| = ${diff}$. Find the larger value.`;
        const correct = String(Math.max(x, y));
        const dist = [String(Math.min(x, y)), String(diff), String(ratioA + ratioB)];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `Let $x = ${ratioA}k$ and $y = ${ratioB}k$. Then $|${ratioA - ratioB}k| = ${diff}$, so $k = ${k}$ and the larger value is ${Math.max(x, y)}$.`,
          1.35,
          sourceSection,
          ["disguise", "proportion"]
        );
      } else {
        // Symmetric-looking but linear in combination
        const x = rng.randInt(-4, 4);
        const y = rng.randInt(-4, 4);
        const s = x + y;
        const p = x - y;
        const a = rng.randInt(1, 4);
        const b = rng.randInt(1, 4);
        const c1 = a * s + b * p;
        const c2 = b * s - a * p;
        const prompt = `If $x + y = s$ and $x - y = d$, solve $\\begin{cases} ${a}s + ${b}d = ${c1} \\\\ ${b}s - ${a}d = ${c2} \\end{cases}$ for $x$.`;
        const correct = String(x);
        const dist = [String(y), String(s), String(p)];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `Solve for $s$ and $d$, then $x = (s + d)/2 = (${s} + ${p})/2 = ${x}$.`,
          1.45,
          sourceSection,
          ["disguise", "symmetric"]
        );
      }
    }
    problems.push(problem);
  }
  for (const p of problems) fixDistractors(p, rng);
  return problems;
}

function generateMoreVariables(difficulty: Difficulty, rng: SeededRandom): Problem[] {
  const topicId = "ch5.more_variables";
  const sourceSection = "5.6";
  const problems: Problem[] = [];

  for (let i = 0; i < 50; i++) {
    let problem: Problem;
    const type = i % 4;

    if (difficulty === "easy") {
      if (type < 2) {
        // One variable known
        const x = rng.randInt(-5, 5);
        const y = rng.randInt(-5, 5);
        const z = rng.randInt(-5, 5);
        const a = rng.randInt(1, 4);
        const b = rng.randInt(1, 4);
        const c1 = a * x + b * y;
        const c2 = x - y;
        const prompt = `Solve $\\begin{cases} ${a}x + ${b}y = ${c1} \\\\ x - y = ${c2} \\\\ z = ${z} \\end{cases}$.`;
        const correct = formatOrderedPair3(x, y, z);
        const dist = [
          formatOrderedPair3(x + 1, y, z),
          formatOrderedPair3(x, y + 1, z),
          formatOrderedPair3(x, y, z + 1),
        ];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "string",
          correct,
          choices,
          correctChoiceId,
          `From $z = ${z}$, solve the first two equations to get $x = ${x}$ and $y = ${y}$.`,
          0.95,
          sourceSection,
          ["three_variables", "systems"]
        );
      } else {
        // Sum of variables given
        const x = rng.randInt(1, 6);
        const y = rng.randInt(1, 6);
        const z = rng.randInt(1, 6);
        const sum = x + y + z;
        const prompt = `If $x + y + z = ${sum}$, $x = ${x}$, and $y = ${y}$, what is $z$?`;
        const correct = String(z);
        const dist = [String(sum), String(x + y), String(sum - x)];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `Substitute: $${x} + ${y} + z = ${sum}$, so $z = ${z}$.`,
          0.85,
          sourceSection,
          ["three_variables", "evaluation"]
        );
      }
    } else if (difficulty === "medium") {
      if (type < 2) {
        // Standard 3x3
        const x = rng.randInt(-3, 3);
        const y = rng.randInt(-3, 3);
        const z = rng.randInt(-3, 3);
        const a1 = rng.randInt(1, 3);
        const b1 = rng.randInt(1, 3);
        const c1 = rng.randInt(1, 3);
        const d1 = a1 * x + b1 * y + c1 * z;
        const a2 = rng.randInt(1, 3);
        const b2 = rng.randInt(1, 3);
        const c2 = rng.randInt(1, 3);
        const d2 = a2 * x + b2 * y + c2 * z;
        const a3 = rng.randInt(1, 3);
        const b3 = rng.randInt(1, 3);
        const c3 = rng.randInt(1, 3);
        const d3 = a3 * x + b3 * y + c3 * z;
        const prompt = `Solve $\\begin{cases} ${a1}x + ${b1}y + ${c1}z = ${d1} \\\\ ${a2}x + ${b2}y + ${c2}z = ${d2} \\\\ ${a3}x + ${b3}y + ${c3}z = ${d3} \\end{cases}$.`;
        const correct = formatOrderedPair3(x, y, z);
        const dist = [
          formatOrderedPair3(x + 1, y, z),
          formatOrderedPair3(x, y + 1, z),
          formatOrderedPair3(x, y, z + 1),
        ];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "string",
          correct,
          choices,
          correctChoiceId,
          `Eliminate one variable using two pairs of equations, solve the resulting 2-variable system, then back-substitute to get $(x,y,z) = (${x},${y},${z})$.`,
          1.25,
          sourceSection,
          ["three_variables", "systems"]
        );
      } else if (type === 2) {
        // One simple relation
        const x = rng.randInt(-3, 3);
        const y = rng.randInt(-3, 3);
        const z = rng.randInt(-3, 3);
        const a = rng.randInt(1, 3);
        const b = rng.randInt(1, 3);
        const c1 = a * x + b * y;
        const c2 = x + z;
        const c3 = y - z;
        const prompt = `Solve $\\begin{cases} ${a}x + ${b}y = ${c1} \\\\ x + z = ${c2} \\\\ y - z = ${c3} \\end{cases}$.`;
        const correct = formatOrderedPair3(x, y, z);
        const dist = [
          formatOrderedPair3(x + 1, y, z),
          formatOrderedPair3(x, y + 1, z),
          formatOrderedPair3(x, y, z + 1),
        ];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "string",
          correct,
          choices,
          correctChoiceId,
          `From the last two equations, express $z$ in terms of $x$ and $y$, substitute into the first, and solve.`,
          1.2,
          sourceSection,
          ["three_variables", "systems"]
        );
      } else {
        // Sum/difference pattern
        const x = rng.randInt(1, 6);
        const y = rng.randInt(1, 6);
        const z = rng.randInt(1, 6);
        const s1 = x + y;
        const s2 = y + z;
        const s3 = x + z;
        const prompt = `Solve $\\begin{cases} x + y = ${s1} \\\\ y + z = ${s2} \\\\ x + z = ${s3} \\end{cases}$ for $x$.`;
        const correct = String(x);
        const dist = [String(y), String(z), String((s1 + s2 + s3) / 2)];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `Add all three equations: $2(x + y + z) = ${s1 + s2 + s3}$, so $x + y + z = ${(s1 + s2 + s3) / 2}$ and $x = ${x}$.`,
          1.2,
          sourceSection,
          ["three_variables", "sum_pattern"]
        );
      }
    } else {
      // Hard
      if (type < 2) {
        // Larger coefficients 3x3
        const x = rng.randInt(-4, 4);
        const y = rng.randInt(-4, 4);
        const z = rng.randInt(-4, 4);
        const a1 = rng.randInt(2, 5);
        const b1 = rng.randInt(2, 5);
        const c1 = rng.randInt(1, 4);
        const d1 = a1 * x + b1 * y + c1 * z;
        const a2 = rng.randInt(2, 5);
        const b2 = rng.randInt(1, 4);
        const c2 = rng.randInt(2, 5);
        const d2 = a2 * x + b2 * y + c2 * z;
        const a3 = rng.randInt(1, 4);
        const b3 = rng.randInt(2, 5);
        const c3 = rng.randInt(2, 5);
        const d3 = a3 * x + b3 * y + c3 * z;
        const prompt = `Solve $\\begin{cases} ${a1}x + ${b1}y + ${c1}z = ${d1} \\\\ ${a2}x + ${b2}y + ${c2}z = ${d2} \\\\ ${a3}x + ${b3}y + ${c3}z = ${d3} \\end{cases}$.`;
        const correct = formatOrderedPair3(x, y, z);
        const dist = [
          formatOrderedPair3(x + 1, y, z),
          formatOrderedPair3(x, y + 1, z),
          formatOrderedPair3(x, y, z + 1),
        ];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "string",
          correct,
          choices,
          correctChoiceId,
          `Eliminate one variable twice to get a 2-variable system, solve it, then back-substitute for $z$. The solution is $(x,y,z) = (${x},${y},${z})$.`,
          1.45,
          sourceSection,
          ["three_variables", "systems"]
        );
      } else if (type === 2) {
        // Parameteric in 3 variables
        const k = rng.randInt(1, 4);
        const x = rng.randInt(-3, 3);
        const y = rng.randInt(-3, 3);
        const z = rng.randInt(-3, 3);
        const a = rng.randInt(1, 3);
        const b = rng.randInt(1, 3);
        const c1 = a * x + b * y + k * z;
        const c2 = x - y;
        const c3 = y + z;
        const prompt = `Solve $\\begin{cases} ${a}x + ${b}y + ${k}z = ${c1} \\\\ x - y = ${c2} \\\\ y + z = ${c3} \\end{cases}$ for $z$.`;
        const correct = String(z);
        const dist = [String(x), String(y), String(x + y)];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `Express $x = y + ${c2}$ and use $y = ${c3} - z$ to substitute into the first equation, yielding $z = ${z}$.`,
          1.4,
          sourceSection,
          ["three_variables", "parameter"]
        );
      } else {
        // Sum/difference with scaling
        const x = rng.randInt(1, 6);
        const y = rng.randInt(1, 6);
        const z = rng.randInt(1, 6);
        const a = rng.randInt(2, 4);
        const b = rng.randInt(2, 4);
        const c = rng.randInt(2, 4);
        const s1 = a * x + b * y;
        const s2 = b * y + c * z;
        const s3 = c * z + a * x;
        const prompt = `Solve $\\begin{cases} ${a}x + ${b}y = ${s1} \\\\ ${b}y + ${c}z = ${s2} \\\\ ${c}z + ${a}x = ${s3} \\end{cases}$ for $x + y + z$.`;
        const correct = String(x + y + z);
        const dist = [String(x), String(y), String(z)];
        const { choices, correctChoiceId } = makeChoices(correct, dist, rng);
        problem = makeProblem(
          topicId,
          difficulty,
          i,
          prompt,
          "integer",
          correct,
          choices,
          correctChoiceId,
          `Add all three equations: $2(${a}x + ${b}y + ${c}z) = ${s1 + s2 + s3}$. Combine with the first equation to find $x + y + z = ${x + y + z}$.`,
          1.5,
          sourceSection,
          ["three_variables", "sum_pattern"]
        );
      }
    }
    problems.push(problem);
  }
  for (const p of problems) fixDistractors(p, rng);
  return problems;
}

function main() {
  const generators: {
    topicId: string;
    sourceSection: string;
    fn: (difficulty: Difficulty, rng: SeededRandom) => Problem[];
  }[] = [
    { topicId: "ch5.intro_two_var", sourceSection: "5.1", fn: generateIntroTwoVar },
    { topicId: "ch5.substitution", sourceSection: "5.2", fn: generateSubstitution },
    { topicId: "ch5.elimination", sourceSection: "5.3", fn: generateElimination },
    { topicId: "ch5.word_problems", sourceSection: "5.4", fn: generateWordProblems },
    { topicId: "ch5.more_disguise", sourceSection: "5.5", fn: generateMoreDisguise },
    { topicId: "ch5.more_variables", sourceSection: "5.6", fn: generateMoreVariables },
  ];

  const outDir = path.join(process.cwd(), "content", "problems", GROUP_ID);
  fs.mkdirSync(outDir, { recursive: true });

  let total = 0;
  for (const { topicId, fn } of generators) {
    for (const difficulty of ["easy", "medium", "hard"] as Difficulty[]) {
      const seed = hashString(`${topicId}.${difficulty}`);
      const rng = new SeededRandom(seed);
      const problems = fn(difficulty, rng);
      const filePath = path.join(outDir, `${topicId}.${difficulty}.json`);
      fs.writeFileSync(filePath, JSON.stringify(problems, null, 2));
      total += problems.length;
      console.log(`Wrote ${problems.length} problems to ${filePath}`);
    }
  }
  console.log(`Total generated: ${total}`);
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return h >>> 0;
}

main();
