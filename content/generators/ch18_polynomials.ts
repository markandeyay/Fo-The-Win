import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { create, all } from "mathjs";

type Difficulty = "easy" | "medium" | "hard";
type AnswerType = "integer" | "expression";

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

const math = create(all, {});
const GROUP_ID = "ch18_polynomials";
const OUT_DIR = path.join(process.cwd(), "content", "problems", GROUP_ID);
const CHOICE_IDS = ["a", "b", "c", "d"];

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

  nonzero(min: number, max: number): number {
    let value = 0;
    while (value === 0) value = this.int(min, max);
    return value;
  }

  pick<T>(items: T[]): T {
    return items[this.int(0, items.length - 1)];
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

function trimPoly(poly: number[]): number[] {
  const out = [...poly];
  while (out.length > 1 && out[out.length - 1] === 0) out.pop();
  return out;
}

function addPoly(a: number[], b: number[]): number[] {
  const n = Math.max(a.length, b.length);
  const out = Array(n).fill(0);
  for (let i = 0; i < n; i++) out[i] = (a[i] ?? 0) + (b[i] ?? 0);
  return trimPoly(out);
}

function subPoly(a: number[], b: number[]): number[] {
  const n = Math.max(a.length, b.length);
  const out = Array(n).fill(0);
  for (let i = 0; i < n; i++) out[i] = (a[i] ?? 0) - (b[i] ?? 0);
  return trimPoly(out);
}

function scalePoly(poly: number[], scalar: number): number[] {
  return trimPoly(poly.map((coef) => coef * scalar));
}

function mulPoly(a: number[], b: number[]): number[] {
  const out = Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
  }
  return trimPoly(out);
}

function evalPoly(poly: number[], x: number): number {
  return poly.reduce((sum, coef, power) => sum + coef * x ** power, 0);
}

function randomPoly(rng: Rng, degree: number, min: number, max: number, allowZero = true): number[] {
  const poly = Array(degree + 1).fill(0).map(() => (allowZero ? rng.int(min, max) : rng.nonzero(min, max)));
  poly[degree] = rng.nonzero(min, max);
  return trimPoly(poly);
}

function randomSparsePoly(rng: Rng, degree: number, min: number, max: number): number[] {
  const poly = randomPoly(rng, degree, min, max, true);
  const zeroIndex = rng.int(0, degree - 1);
  poly[zeroIndex] = 0;
  return trimPoly(poly);
}

function monomial(rng: Rng, coefMin: number, coefMax: number, degreeMin: number, degreeMax: number): number[] {
  const degree = rng.int(degreeMin, degreeMax);
  const poly = Array(degree + 1).fill(0);
  poly[degree] = rng.nonzero(coefMin, coefMax);
  return poly;
}

function latexPoly(poly: number[]): string {
  const terms: string[] = [];
  for (let power = poly.length - 1; power >= 0; power--) {
    const coef = poly[power];
    if (coef === 0) continue;
    const abs = Math.abs(coef);
    const variable = power === 0 ? "" : power === 1 ? "x" : `x^${power}`;
    const core = variable === "" ? `${abs}` : abs === 1 ? variable : `${abs}${variable}`;
    if (terms.length === 0) terms.push(coef < 0 ? `-${core}` : core);
    else terms.push(coef < 0 ? `- ${core}` : `+ ${core}`);
  }
  return terms.join(" ") || "0";
}

function plainPoly(poly: number[]): string {
  const terms: string[] = [];
  for (let power = poly.length - 1; power >= 0; power--) {
    const coef = poly[power];
    if (coef === 0) continue;
    const abs = Math.abs(coef);
    const variable = power === 0 ? "" : power === 1 ? "x" : `x^${power}`;
    const core = variable === "" ? `${abs}` : abs === 1 ? variable : `${abs}*${variable}`;
    if (terms.length === 0) terms.push(coef < 0 ? `-${core}` : core);
    else terms.push(coef < 0 ? `-${core}` : `+${core}`);
  }
  return terms.join("") || "0";
}

function wrap(latex: string): string {
  return `$${latex}$`;
}

function parens(latex: string): string {
  return `\\left(${latex}\\right)`;
}

function signedScalar(n: number): string {
  if (n === 1) return "";
  if (n === -1) return "-";
  return `${n}`;
}

function distinctPolys(candidates: number[][], correct: number[]): number[][] {
  const seen = new Set<string>([plainPoly(correct)]);
  const out: number[][] = [];
  for (const candidate of candidates) {
    const trimmed = trimPoly(candidate);
    const key = plainPoly(trimmed);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(trimmed);
    }
    if (out.length === 3) break;
  }
  return out;
}

function distinctIntegers(candidates: number[], correct: number): number[] {
  const seen = new Set<number>([correct]);
  const out: number[] = [];
  for (const candidate of candidates) {
    if (!seen.has(candidate)) {
      seen.add(candidate);
      out.push(candidate);
    }
    if (out.length === 3) break;
  }
  return out;
}

function makeMC(correctLatex: string, distractors: string[], rng: Rng): { choices: Choice[]; correct_choice: string } {
  if (new Set([correctLatex, ...distractors].map((x) => x.replace(/\s+/g, ""))).size !== 4) {
    throw new Error(`Choices are not distinct for ${correctLatex}`);
  }
  const rows = rng.shuffle([{ latex: correctLatex, correct: true }, ...distractors.map((latex) => ({ latex, correct: false }))]);
  const choices = rows.map((row, index) => ({ id: CHOICE_IDS[index], latex: row.latex }));
  return { choices, correct_choice: choices[rows.findIndex((row) => row.correct)].id };
}

function verifyExpression(correct: number[], expression: string): void {
  const node = math.parse(expression.replace(/\^/g, "^"));
  for (const x of [-3, -1, 0, 2, 5]) {
    const expected = evalPoly(correct, x);
    const actual = node.evaluate({ x });
    if (Math.abs(actual - expected) > 1e-9) throw new Error(`Verification failed for ${expression} at x=${x}`);
  }
}

function makeProblem(args: {
  index: number;
  topic: "ch18.add_subtract" | "ch18.multiplication";
  difficulty: Difficulty;
  source: "18.1" | "18.2";
  prompt: string;
  correctAnswer: string;
  correctLatex: string;
  answerType: AnswerType;
  distractors: string[];
  solution: string;
  complexity: number;
  tags: string[];
  rng: Rng;
  acceptedForms?: string[];
}): Problem {
  const mc = makeMC(args.correctLatex, args.distractors, args.rng);
  const problem: Problem = {
    id: `${args.topic}.${args.difficulty}.${String(args.index).padStart(4, "0")}`,
    topic_id: args.topic,
    group_id: GROUP_ID,
    difficulty: args.difficulty,
    prompt_latex: args.prompt,
    answer_format: "mc",
    choices: mc.choices,
    correct_choice: mc.correct_choice,
    correct_answer: args.correctAnswer,
    answer_type: args.answerType,
    accepted_forms: args.acceptedForms ?? [],
    solution_latex: args.solution,
    complexity_factor: args.complexity,
    source_section: args.source,
    tags: args.tags,
    checksum: "",
    status: "valid",
  };
  problem.checksum = checksum(problem);
  return problem;
}

function addSubProblem(index: number, difficulty: Difficulty, rng: Rng): Problem {
  if (difficulty === "easy") {
    const op = rng.pick(["+", "-"] as const);
    const a = randomPoly(rng, rng.pick([2, 3]), -6, 7, true);
    const b = randomPoly(rng, a.length - 1, -5, 6, true);
    const correct = op === "+" ? addPoly(a, b) : subPoly(a, b);
    const wrongSign = op === "+" ? subPoly(a, b) : addPoly(a, b);
    const noConstants = [...correct];
    noConstants[0] = a[0] ?? 0;
    const candidates = distinctPolys([
      wrongSign,
      noConstants,
      correct.map((c, i) => (i === 1 ? c + rng.pick([-2, -1, 1, 2]) : c)),
      addPoly(correct, [rng.pick([-3, -2, 2, 3])]),
    ], correct);
    if (candidates.length < 3) return addSubProblem(index, difficulty, rng);
    verifyExpression(correct, plainPoly(correct));
    const prompt = `Simplify: $${parens(latexPoly(a))} ${op} ${parens(latexPoly(b))}$.`;
    const solution = op === "+"
      ? `Combine like terms: $${latexPoly(a)} + ${parens(latexPoly(b))} = ${latexPoly(correct)}$.`
      : `Subtract by changing the signs in the second polynomial, then combine like terms: $${latexPoly(correct)}$.`;
    return makeProblem({
      index,
      topic: "ch18.add_subtract",
      difficulty,
      source: "18.1",
      prompt,
      correctAnswer: plainPoly(correct),
      correctLatex: wrap(latexPoly(correct)),
      answerType: "expression",
      distractors: candidates.map((p) => wrap(latexPoly(p))),
      solution,
      complexity: 0.95,
      tags: ["polynomials", "addition", "subtraction", "like_terms"],
      rng,
    });
  }

  if (difficulty === "medium") {
    const p = randomSparsePoly(rng, rng.pick([3, 4]), -5, 6);
    const q = randomPoly(rng, p.length - 1, -4, 5, true);
    const a = rng.pick([2, 3, -2]);
    const b = rng.pick([-3, -2, 2, 4]);
    const correct = addPoly(scalePoly(p, a), scalePoly(q, b));
    const wrongBSign = addPoly(scalePoly(p, a), scalePoly(q, -b));
    const unscaled = addPoly(p, q);
    const slip = [...correct];
    slip[rng.int(0, slip.length - 1)] += rng.pick([-3, -2, 2, 3]);
    const candidates = distinctPolys([wrongBSign, unscaled, slip, subPoly(scalePoly(p, a), scalePoly(q, b))], correct);
    if (candidates.length < 3) return addSubProblem(index, difficulty, rng);
    verifyExpression(correct, plainPoly(correct));
    const prompt = `Let $P(x)=${latexPoly(p)}$ and $Q(x)=${latexPoly(q)}$. Simplify $${signedScalar(a)}P(x) ${b >= 0 ? "+" : "-"} ${Math.abs(b)}Q(x)$.`;
    const solution = `Distribute the coefficients to $P(x)$ and $Q(x)$, then combine like powers of $x$ to get $${latexPoly(correct)}$.`;
    return makeProblem({
      index,
      topic: "ch18.add_subtract",
      difficulty,
      source: "18.1",
      prompt,
      correctAnswer: plainPoly(correct),
      correctLatex: wrap(latexPoly(correct)),
      answerType: "expression",
      distractors: candidates.map((poly) => wrap(latexPoly(poly))),
      solution,
      complexity: 1.1,
      tags: ["polynomials", "linear_combination", "like_terms"],
      rng,
    });
  }

  const p = randomPoly(rng, 4, -4, 5, true);
  const q = randomSparsePoly(rng, 4, -5, 5);
  const r = randomPoly(rng, 3, -3, 4, true);
  const correct = addPoly(subPoly(p, q), scalePoly(r, 2));
  const noDistributeMinus = addPoly(addPoly(p, q), scalePoly(r, 2));
  const onlyOneR = addPoly(subPoly(p, q), r);
  const slip = [...correct];
  slip[rng.int(0, slip.length - 1)] += rng.pick([-4, -2, 2, 4]);
  const candidates = distinctPolys([noDistributeMinus, onlyOneR, slip, subPoly(subPoly(p, q), scalePoly(r, 2))], correct);
  if (candidates.length < 3) return addSubProblem(index, difficulty, rng);
  verifyExpression(correct, plainPoly(correct));
  const prompt = `Simplify: $${parens(latexPoly(p))} - ${parens(latexPoly(q))} + 2${parens(latexPoly(r))}$.`;
  const solution = `First distribute the minus sign and the $2$, then combine like terms. This gives $${latexPoly(correct)}$.`;
  return makeProblem({
    index,
    topic: "ch18.add_subtract",
    difficulty,
    source: "18.1",
    prompt,
    correctAnswer: plainPoly(correct),
    correctLatex: wrap(latexPoly(correct)),
    answerType: "expression",
    distractors: candidates.map((poly) => wrap(latexPoly(poly))),
    solution,
    complexity: 1.25,
    tags: ["polynomials", "subtraction", "distribution", "like_terms"],
    rng,
  });
}

function multiplicationProblem(index: number, difficulty: Difficulty, rng: Rng): Problem {
  if (difficulty === "easy") {
    const useMonomial = index % 2 === 0;
    const a = useMonomial ? monomial(rng, -5, 6, 1, 2) : randomPoly(rng, 1, -5, 6, false);
    const b = randomPoly(rng, useMonomial ? rng.pick([1, 2]) : 1, -5, 6, false);
    const correct = mulPoly(a, b);
    const addInstead = addPoly(a, b);
    const signSlip = scalePoly(correct, -1);
    const partial = [...correct];
    partial[0] = 0;
    const coefSlip = [...correct];
    coefSlip[rng.int(0, coefSlip.length - 1)] += rng.pick([-3, -2, 2, 3]);
    const candidates = distinctPolys([addInstead, signSlip, partial, coefSlip], correct);
    if (candidates.length < 3) return multiplicationProblem(index, difficulty, rng);
    verifyExpression(correct, plainPoly(correct));
    const prompt = `Expand: $${parens(latexPoly(a))}${parens(latexPoly(b))}$.`;
    const solution = `Multiply each term in the first factor by each term in the second factor and combine like terms: $${latexPoly(correct)}$.`;
    return makeProblem({
      index,
      topic: "ch18.multiplication",
      difficulty,
      source: "18.2",
      prompt,
      correctAnswer: plainPoly(correct),
      correctLatex: wrap(latexPoly(correct)),
      answerType: "expression",
      distractors: candidates.map((poly) => wrap(latexPoly(poly))),
      solution,
      complexity: 1.0,
      tags: ["polynomials", "multiplication", "expansion"],
      rng,
    });
  }

  if (difficulty === "medium") {
    const a = randomPoly(rng, rng.pick([1, 2]), -5, 6, false);
    const b = randomPoly(rng, rng.pick([2, 3]), -4, 5, false);
    const correct = mulPoly(a, b);
    const addInstead = addPoly(a, b);
    const missingMiddle = [...correct];
    if (missingMiddle.length > 2) missingMiddle[1] = 0;
    const signSlip = [...correct];
    signSlip[rng.int(0, signSlip.length - 1)] *= -1;
    const coefSlip = [...correct];
    coefSlip[rng.int(0, coefSlip.length - 1)] += rng.pick([-4, -2, 2, 4]);
    const candidates = distinctPolys([addInstead, missingMiddle, signSlip, coefSlip], correct);
    if (candidates.length < 3) return multiplicationProblem(index, difficulty, rng);
    verifyExpression(correct, plainPoly(correct));
    const prompt = `Expand and combine like terms: $${parens(latexPoly(a))}${parens(latexPoly(b))}$.`;
    const solution = `Using distribution, the product has coefficients from all pairwise term products. Combining like powers gives $${latexPoly(correct)}$.`;
    return makeProblem({
      index,
      topic: "ch18.multiplication",
      difficulty,
      source: "18.2",
      prompt,
      correctAnswer: plainPoly(correct),
      correctLatex: wrap(latexPoly(correct)),
      answerType: "expression",
      distractors: candidates.map((poly) => wrap(latexPoly(poly))),
      solution,
      complexity: 1.15,
      tags: ["polynomials", "multiplication", "binomial", "trinomial"],
      rng,
    });
  }

  if (index % 2 === 1) {
    const a = randomPoly(rng, 2, -4, 5, false);
    const b = randomPoly(rng, 3, -3, 4, false);
    const correctPoly = mulPoly(a, b);
    const power = rng.int(2, Math.min(4, correctPoly.length - 1));
    const correct = correctPoly[power];
    const wrongAdd = (a[power] ?? 0) + (b[power] ?? 0);
    const wrongNeighbor = correctPoly[power - 1] ?? correct + 1;
    const wrongSign = -correct;
    const wrongSlip = correct + rng.pick([-6, -3, 3, 6]);
    const distractors = distinctIntegers([wrongAdd, wrongNeighbor, wrongSign, wrongSlip], correct);
    if (distractors.length < 3) return multiplicationProblem(index, difficulty, rng);
    const prompt = `What is the coefficient of $x^${power}$ in $${parens(latexPoly(a))}${parens(latexPoly(b))}$?`;
    const solution = `Add the products of coefficient pairs whose powers sum to ${power}. In the expanded product $${latexPoly(correctPoly)}$, the coefficient of $x^${power}$ is $${correct}$.`;
    return makeProblem({
      index,
      topic: "ch18.multiplication",
      difficulty,
      source: "18.2",
      prompt,
      correctAnswer: `${correct}`,
      correctLatex: wrap(`${correct}`),
      answerType: "integer",
      distractors: distractors.map((n) => wrap(`${n}`)),
      solution,
      complexity: 1.35,
      tags: ["polynomials", "multiplication", "coefficient"],
      rng,
    });
  }

  const a = randomPoly(rng, 2, -4, 5, false);
  const b = randomPoly(rng, 2, -4, 5, false);
  const c = randomPoly(rng, 1, -5, 6, false);
  const correct = mulPoly(mulPoly(a, b), c);
  const missC = mulPoly(a, b);
  const addLast = addPoly(mulPoly(a, b), c);
  const signSlip = [...correct];
  signSlip[rng.int(0, signSlip.length - 1)] *= -1;
  const coefSlip = [...correct];
  coefSlip[rng.int(0, coefSlip.length - 1)] += rng.pick([-5, -2, 2, 5]);
  const candidates = distinctPolys([missC, addLast, signSlip, coefSlip], correct);
  if (candidates.length < 3) return multiplicationProblem(index, difficulty, rng);
  verifyExpression(correct, plainPoly(correct));
  const prompt = `Expand fully: $${parens(latexPoly(a))}${parens(latexPoly(b))}${parens(latexPoly(c))}$.`;
  const solution = `Multiply two factors first, then distribute the remaining factor and combine like terms. The result is $${latexPoly(correct)}$.`;
  return makeProblem({
    index,
    topic: "ch18.multiplication",
    difficulty,
    source: "18.2",
    prompt,
    correctAnswer: plainPoly(correct),
    correctLatex: wrap(latexPoly(correct)),
    answerType: "expression",
    distractors: candidates.map((poly) => wrap(latexPoly(poly))),
    solution,
    complexity: 1.4,
    tags: ["polynomials", "multiplication", "multiple_factors"],
    rng,
  });
}

function generateSet(topic: "ch18.add_subtract" | "ch18.multiplication", difficulty: Difficulty): Problem[] {
  const seedBase = topic === "ch18.add_subtract" ? 1801 : 1802;
  const seedOffset = difficulty === "easy" ? 11 : difficulty === "medium" ? 37 : 73;
  const rng = new Rng(seedBase * 100 + seedOffset);
  const problems: Problem[] = [];
  const checksums = new Set<string>();
  while (problems.length < 50) {
    const index = problems.length + 1;
    const problem = topic === "ch18.add_subtract"
      ? addSubProblem(index, difficulty, rng)
      : multiplicationProblem(index, difficulty, rng);
    if (!checksums.has(problem.checksum)) {
      checksums.add(problem.checksum);
      problems.push(problem);
    }
  }
  return problems;
}

function main(): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const topics = ["ch18.add_subtract", "ch18.multiplication"] as const;
  const difficulties = ["easy", "medium", "hard"] as const;
  for (const topic of topics) {
    for (const difficulty of difficulties) {
      const problems = generateSet(topic, difficulty);
      const file = path.join(OUT_DIR, `${topic}.${difficulty}.json`);
      fs.writeFileSync(file, JSON.stringify(problems, null, 2) + "\n");
      console.log(`${file}: ${problems.length}`);
    }
  }
}

main();
