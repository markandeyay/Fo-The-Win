import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type Difficulty = "easy" | "medium" | "hard";
type AnswerType = "integer" | "fraction" | "decimal" | "expression" | "ordered_pair" | "set" | "interval" | "boolean" | "string";

interface ChoiceInput {
  value: string;
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

const groupId = "ch21_sequences_series";
const choiceIds = ["a", "b", "c", "d"];
const difficulties: Difficulty[] = ["easy", "medium", "hard"];

function checksum(problem: Pick<Problem, "topic_id" | "difficulty" | "prompt_latex" | "correct_answer">): string {
  const payload = problem.topic_id + problem.difficulty + problem.prompt_latex + problem.correct_answer;
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
  return a || 1;
}

function frac(num: number, den: number): string {
  if (den < 0) return frac(-num, -den);
  const g = gcd(num, den);
  return `${num / g}/${den / g}`;
}

function addFrac(a: string, b: string): string {
  const [an, ad] = a.split("/").map(Number);
  const [bn, bd] = b.split("/").map(Number);
  return frac(an * bd + bn * ad, ad * bd);
}

function subFrac(a: string, b: string): string {
  const [bn, bd] = b.split("/").map(Number);
  return addFrac(a, frac(-bn, bd));
}

function mulFrac(a: string, m: number): string {
  const [an, ad] = a.split("/").map(Number);
  return frac(an * m, ad);
}

function scaleFrac(a: string, num: number, den: number): string {
  const [an, ad] = a.split("/").map(Number);
  return frac(an * num, ad * den);
}

function pow(base: number, exp: number): number {
  return Math.pow(base, exp);
}

function pick(values: number[], index: number): number {
  return values[((index % values.length) + values.length) % values.length];
}

function normalizeKey(value: string, answerType: AnswerType): string {
  if (answerType === "fraction") {
    const [n, d] = value.split("/").map(Number);
    return frac(n, d);
  }
  return value.replace(/\s+/g, "").toLowerCase();
}

function valueLatex(value: string): string {
  return `$${value}$`;
}

function fallbackValue(correct: string, answerType: AnswerType, bump: number): string {
  if (answerType === "fraction") {
    const [n, d] = correct.split("/").map(Number);
    return frac(n + bump, d + bump + 1);
  }
  return `${Number(correct) + bump}`;
}

function uniqueChoices(correct: ChoiceInput, distractors: ChoiceInput[], answerType: AnswerType): ChoiceInput[] {
  const seen = new Set<string>();
  const out: ChoiceInput[] = [];
  for (const candidate of [correct, ...distractors]) {
    const key = normalizeKey(candidate.value, answerType);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
  }
  let bump = 1;
  while (out.length < 4) {
    const candidate = { value: fallbackValue(correct.value, answerType, bump) };
    const key = normalizeKey(candidate.value, answerType);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(candidate);
    }
    bump += 1;
  }
  return out.slice(0, 4);
}

function buildProblem(args: {
  index: number;
  topicId: string;
  difficulty: Difficulty;
  prompt: string;
  correct: string;
  distractors: string[];
  answerType: AnswerType;
  solution: string;
  complexity: number;
  section: string;
  tags: string[];
}): Problem {
  const allChoices = uniqueChoices({ value: args.correct }, args.distractors.map((value) => ({ value })), args.answerType);
  const shift = (args.index * 5 + args.topicId.length + args.difficulty.length) % 4;
  const ordered = allChoices.map((_, j) => allChoices[(j - shift + 4) % 4]);
  const correctIndex = ordered.findIndex((choice) => normalizeKey(choice.value, args.answerType) === normalizeKey(args.correct, args.answerType));
  const problem: Problem = {
    id: `${args.topicId}.${args.difficulty}.${String(args.index + 1).padStart(4, "0")}`,
    topic_id: args.topicId,
    group_id: groupId,
    difficulty: args.difficulty,
    prompt_latex: args.prompt,
    answer_format: "mc",
    choices: ordered.map((choice, j) => ({ id: choiceIds[j], latex: valueLatex(choice.value) })),
    correct_choice: choiceIds[correctIndex],
    correct_answer: args.correct,
    answer_type: args.answerType,
    accepted_forms: [],
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

function arithTerm(a1: number, d: number, n: number): number {
  return a1 + (n - 1) * d;
}

function arithSum(a1: number, d: number, n: number): number {
  return (n * (2 * a1 + (n - 1) * d)) / 2;
}

function generateArithmeticSequences(difficulty: Difficulty, index: number): Problem {
  const topicId = "ch21.arithmetic_sequences";
  if (difficulty === "easy") {
    const a1 = pick([-12, -9, -5, -2, 3, 6, 10, 14], index) + 20 * Math.floor(index / 24);
    const d = pick([-6, -4, -3, 2, 3, 5, 7, 9], index * 2 + 1);
    const n = 5 + (index % 12);
    const answer = arithTerm(a1, d, n);
    return buildProblem({
      index,
      topicId,
      difficulty,
      prompt: `An arithmetic sequence has $a_1=${a1}$ and common difference $d=${d}$. Find $a_{${n}}$.`,
      correct: `${answer}`,
      distractors: [`${a1 + n * d}`, `${a1 + (n - 2) * d}`, `${a1 * n + d}`],
      answerType: "integer",
      solution: `Use $a_n=a_1+(n-1)d$: $a_{${n}}=${a1}+${n - 1}(${d})=${answer}$.`,
      complexity: 1.2,
      section: "21.1",
      tags: ["arithmetic-sequence", "nth-term"],
    });
  }
  if (difficulty === "medium") {
    const a1 = pick([-20, -15, -8, -3, 4, 9, 12, 18], index);
    const d = pick([-5, -3, -2, 2, 4, 6, 7], index * 3 + 2);
    const p = 2 + (index % 5);
    const q = p + 4 + (index % 4);
    const n = q + 2 + (index % 5);
    const ap = arithTerm(a1, d, p);
    const aq = arithTerm(a1, d, q);
    const answer = arithTerm(a1, d, n);
    const wrongD = Math.trunc((aq - ap) / (q - p + 1));
    return buildProblem({
      index,
      topicId,
      difficulty,
      prompt: `In an arithmetic sequence, $a_{${p}}=${ap}$ and $a_{${q}}=${aq}$. Find $a_{${n}}$.`,
      correct: `${answer}`,
      distractors: [`${ap + (n - p + 1) * d}`, `${ap + (n - p) * wrongD}`, `${aq + (n - q - 1) * d}`],
      answerType: "integer",
      solution: `The common difference is $(${aq}-${ap})/(${q}-${p})=${d}$. Then $a_{${n}}=${ap}+(${n}-${p})(${d})=${answer}$.`,
      complexity: 1.3,
      section: "21.1",
      tags: ["arithmetic-sequence", "common-difference"],
    });
  }
  const a1 = pick([2, 5, 8, 11, 14, 17, 20], index) + 11 * Math.floor(index / 28);
  const d = pick([2, 3, 4, 5, 6, 7, 8], index * 2 + 3);
  const p = 2 + (index % 4);
  const q = p + 8 + (index % 4);
  const r = p + 2 + (index % (q - p - 3));
  const ap = arithTerm(a1, d, p);
  const aq = arithTerm(a1, d, q);
  const ar = arithTerm(a1, d, r);
  return buildProblem({
    index,
    topicId,
    difficulty,
    prompt: `In an arithmetic sequence, $a_{${p}}=${ap}$ and $a_{${q}}=${aq}$. If $a_k=${ar}$, find $k$.`,
    correct: `${r}`,
    distractors: [`${r + 1}`, `${r - 1}`, `${q - p}`],
    answerType: "integer",
    solution: `The common difference is $(${aq}-${ap})/(${q}-${p})=${d}$. Solve $${ap}+(k-${p})${d}=${ar}$ to get $k=${r}$.`,
    complexity: 1.4,
    section: "21.1",
    tags: ["arithmetic-sequence", "index"],
  });
}

function generateArithmeticSeries(difficulty: Difficulty, index: number): Problem {
  const topicId = "ch21.arithmetic_series";
  if (difficulty === "easy") {
    const a1 = pick([1, 3, 5, 7, 10, 12, 15, 18], index) + 20 * Math.floor(index / 30);
    const d = pick([2, 3, 4, 5, 6, 7], index * 2 + 1);
    const n = 4 + (index % 10);
    const answer = arithSum(a1, d, n);
    const an = arithTerm(a1, d, n);
    return buildProblem({
      index,
      topicId,
      difficulty,
      prompt: `Find the sum of the first $${n}$ terms of the arithmetic sequence with $a_1=${a1}$ and $d=${d}$.`,
      correct: `${answer}`,
      distractors: [`${n * an}`, `${arithSum(a1, d, n - 1)}`, `${answer + d * n}`],
      answerType: "integer",
      solution: `The last term is $a_{${n}}=${an}$. Thus $S_{${n}}=\\frac{${n}}{2}(${a1}+${an})=${answer}$.`,
      complexity: 1.2,
      section: "21.2",
      tags: ["arithmetic-series", "sum"],
    });
  }
  if (difficulty === "medium") {
    const a1 = pick([-8, -4, -1, 2, 5, 9, 13], index);
    const d = pick([3, 4, 5, 6, 7, 8], index * 3);
    const n = 7 + (index % 12);
    const an = arithTerm(a1, d, n);
    const answer = arithSum(a1, d, n);
    return buildProblem({
      index,
      topicId,
      difficulty,
      prompt: `An arithmetic series has first term $${a1}$, last term $${an}$, and $${n}$ terms. Find its sum.`,
      correct: `${answer}`,
      distractors: [`${n * (a1 + an)}`, `${Math.trunc((n - 1) * (a1 + an) / 2)}`, `${answer + an - a1}`],
      answerType: "integer",
      solution: `Use $S_n=\\frac{n}{2}(a_1+a_n)$, so $S_{${n}}=\\frac{${n}}{2}(${a1}+${an})=${answer}$.`,
      complexity: 1.3,
      section: "21.2",
      tags: ["arithmetic-series", "first-last"],
    });
  }
  const a1 = pick([2, 3, 4, 5, 6, 7, 8], index);
  const d = pick([2, 3, 4, 5, 6], index * 2 + 1);
  const n = 8 + (index % 12);
  const answer = arithSum(a1, d, n);
  return buildProblem({
    index,
    topicId,
    difficulty,
    prompt: `The sum of the first $n$ terms of an arithmetic sequence with first term $${a1}$ and common difference $${d}$ is $${answer}$. Find $n$.`,
    correct: `${n}`,
    distractors: [`${n - 1}`, `${n + 1}`, `${Math.max(1, n - 2)}`],
    answerType: "integer",
    solution: `Set $${answer}=\\frac{n}{2}(2\\cdot ${a1}+(n-1)${d})$. The positive integer solution is $n=${n}$.`,
    complexity: 1.45,
    section: "21.2",
    tags: ["arithmetic-series", "number-of-terms"],
  });
}

function geomTerm(a1: number, r: number, n: number): number {
  return a1 * pow(r, n - 1);
}

function geomSum(a1: number, r: number, n: number): number {
  return a1 * (pow(r, n) - 1) / (r - 1);
}

function generateGeometricSequences(difficulty: Difficulty, index: number): Problem {
  const topicId = "ch21.geometric_sequences";
  if (difficulty === "easy") {
    const a1 = pick([1, 2, 3, 4, 5, 6, 8, 9], index) + 10 * Math.floor(index / 40);
    const r = pick([2, 3, 4, -2, -3], index * 2 + 1);
    const n = 3 + (index % 5);
    const answer = geomTerm(a1, r, n);
    return buildProblem({
      index,
      topicId,
      difficulty,
      prompt: `A geometric sequence has $a_1=${a1}$ and common ratio $r=${r}$. Find $a_{${n}}$.`,
      correct: `${answer}`,
      distractors: [`${a1 * pow(r, n)}`, `${a1 + (n - 1) * r}`, `${a1 * pow(r, n - 2)}`],
      answerType: "integer",
      solution: `Use $a_n=a_1r^{n-1}$: $a_{${n}}=${a1}(${r})^{${n - 1}}=${answer}$.`,
      complexity: 1.2,
      section: "21.3",
      tags: ["geometric-sequence", "nth-term"],
    });
  }
  if (difficulty === "medium") {
    const a1 = index + 1;
    const r = pick([2, 3, -2, -3], index * 3 + 1);
    const p = 2 + (index % 3);
    const q = p + 2;
    const n = q + 1 + (index % 3);
    const ap = geomTerm(a1, r, p);
    const aq = geomTerm(a1, r, q);
    const answer = geomTerm(a1, r, n);
    return buildProblem({
      index,
      topicId,
      difficulty,
      prompt: `In a geometric sequence, $a_{${p}}=${ap}$ and $a_{${q}}=${aq}$. The common ratio is an integer. Find $a_{${n}}$.`,
      correct: `${answer}`,
      distractors: [`${aq + (n - q) * r}`, `${ap * pow(r, n - p + 1)}`, `${aq * pow(-r, n - q)}`],
      answerType: "integer",
      solution: `Since the terms are two places apart, $r^2=${aq / ap}$, giving $r=${r}$. Then $a_{${n}}=${ap}(${r})^{${n - p}}=${answer}$.`,
      complexity: 1.3,
      section: "21.3",
      tags: ["geometric-sequence", "common-ratio"],
    });
  }
  const a1 = pick([1, 2, 3, 4, 5], index) + 5 * Math.floor(index / 30);
  const r = pick([2, 3, 4], index * 2 + 1);
  const p = 2 + (index % 3);
  const m = p + 2 + (index % 2);
  const q = 2 * m - p;
  const ap = geomTerm(a1, r, p);
  const am = geomTerm(a1, r, m);
  const aq = geomTerm(a1, r, q);
  return buildProblem({
    index,
    topicId,
    difficulty,
    prompt: `In a geometric sequence of positive terms, $a_{${p}}=${ap}$ and $a_{${q}}=${aq}$. Find $a_{${m}}$.`,
    correct: `${am}`,
    distractors: [`${Math.trunc((ap + aq) / 2)}`, `${ap * r}`, `${aq / r}`],
    answerType: "integer",
    solution: `Because $${m}$ is halfway between $${p}$ and $${q}$, $a_{${m}}^2=a_{${p}}a_{${q}}$. Thus $a_{${m}}=\\sqrt{${ap}\\cdot ${aq}}=${am}$.`,
    complexity: 1.45,
    section: "21.3",
    tags: ["geometric-sequence", "geometric-mean"],
  });
}

function finiteFractionGeometricSum(a: number, b: number, n: number): string {
  let total = "0/1";
  for (let k = 0; k < n; k++) total = addFrac(total, frac(a, pow(b, k)));
  return total;
}

function generateGeometricSeries(difficulty: Difficulty, index: number): Problem {
  const topicId = "ch21.geometric_series";
  if (difficulty === "easy") {
    const a1 = pick([1, 2, 3, 4, 5, 6], index) + 10 * Math.floor(index / 30);
    const r = pick([2, 3, 4], index * 2 + 1);
    const n = 3 + (index % 5);
    const answer = geomSum(a1, r, n);
    return buildProblem({
      index,
      topicId,
      difficulty,
      prompt: `Find the sum of the first $${n}$ terms of the geometric sequence with $a_1=${a1}$ and common ratio $${r}$.`,
      correct: `${answer}`,
      distractors: [`${geomTerm(a1, r, n)}`, `${geomSum(a1, r, n - 1)}`, `${a1 * (pow(r, n + 1) - 1) / (r - 1)}`],
      answerType: "integer",
      solution: `Use $S_n=a_1\\frac{r^n-1}{r-1}$: $S_{${n}}=${a1}\\frac{${r}^{${n}}-1}{${r}-1}=${answer}$.`,
      complexity: 1.2,
      section: "21.4",
      tags: ["geometric-series", "sum"],
    });
  }
  if (difficulty === "medium") {
    const a = pick([1, 2, 3, 4, 5, 6], index) + 10 * Math.floor(index / 30);
    const b = pick([2, 3, 4, 5], index * 2 + 1);
    const n = 4 + (index % 5);
    const answer = finiteFractionGeometricSum(a, b, n);
    return buildProblem({
      index,
      topicId,
      difficulty,
      prompt: `Evaluate $\\displaystyle \\sum_{k=0}^{${n - 1}} ${a}\\left(1/${b}\\right)^k$.`,
      correct: answer,
      distractors: [finiteFractionGeometricSum(a, b, n - 1), finiteFractionGeometricSum(a, b, n + 1), frac(a * (pow(b, n) - 1), pow(b, n))],
      answerType: "fraction",
      solution: `This is geometric with ratio $1/${b}$, so the sum is $${a}\\frac{1-(1/${b})^{${n}}}{1-1/${b}}=${answer}$.`,
      complexity: 1.35,
      section: "21.4",
      tags: ["geometric-series", "fractional-ratio"],
    });
  }
  const a1 = pick([1, 2, 3, 4, 5], index) + 10 * Math.floor(index / 30);
  const r = pick([2, 3, 4], index * 2 + 1);
  const n = 4 + (index % 6);
  const answer = geomSum(a1, r, n);
  return buildProblem({
    index,
    topicId,
    difficulty,
    prompt: `A geometric series has first term $${a1}$, common ratio $${r}$, and sum $${answer}$. How many terms are in the series?`,
    correct: `${n}`,
    distractors: [`${n - 1}`, `${n + 1}`, `${Math.max(1, n - 2)}`],
    answerType: "integer",
    solution: `Solve $${answer}=${a1}\\frac{${r}^n-1}{${r}-1}$. This gives $${r}^n=${pow(r, n)}$, so $n=${n}$.`,
    complexity: 1.45,
    section: "21.4",
    tags: ["geometric-series", "number-of-terms"],
  });
}

function telescopeConsecutive(start: number, terms: number, coefficient: number): string {
  return mulFrac(subFrac(frac(1, start), frac(1, start + terms)), coefficient);
}

function telescopeGap(start: number, terms: number, gap: number, numerator: number): string {
  let total = "0/1";
  for (let j = 0; j < gap; j++) {
    total = addFrac(total, frac(1, start + j));
    total = subFrac(total, frac(1, start + terms + j));
  }
  return scaleFrac(total, numerator, gap);
}

function generateTelescoping(difficulty: Difficulty, index: number): Problem {
  const topicId = "ch21.telescoping";
  if (difficulty === "easy") {
    const start = 1 + (index % 4);
    const terms = 3 + index;
    const answer = telescopeConsecutive(start, terms, 1);
    return buildProblem({
      index,
      topicId,
      difficulty,
      prompt: `Evaluate $\\displaystyle \\sum_{n=${start}}^{${start + terms - 1}} \\left(1/n-1/(n+1)\\right)$.`,
      correct: answer,
      distractors: [frac(1, start + terms), frac(terms, start + terms), telescopeConsecutive(start, terms - 1, 1)],
      answerType: "fraction",
      solution: `All middle terms cancel, leaving $1/${start}-1/${start + terms}=${answer}$.`,
      complexity: 1.2,
      section: "21.5",
      tags: ["telescoping", "series"],
    });
  }
  if (difficulty === "medium") {
    const offset = index % 5;
    const terms = 6 + (index % 12);
    const coefficient = pick([1, 2, 3, 4, 5], index * 2 + 1);
    const start = offset + 1;
    const answer = telescopeConsecutive(start, terms, coefficient);
    return buildProblem({
      index,
      topicId,
      difficulty,
      prompt: `Evaluate $\\displaystyle \\sum_{n=1}^{${terms}} \\frac{${coefficient}}{(n+${offset})(n+${offset + 1})}$.`,
      correct: answer,
      distractors: [telescopeConsecutive(start, terms, 1), telescopeConsecutive(start, terms + 1, coefficient), frac(coefficient * terms, (start + terms) * start)],
      answerType: "fraction",
      solution: `Since $\\frac{${coefficient}}{(n+${offset})(n+${offset + 1})}=${coefficient}\\left(\\frac{1}{n+${offset}}-\\frac{1}{n+${offset + 1}}\\right)$, the sum is $${coefficient}(1/${start}-1/${start + terms})=${answer}$.`,
      complexity: 1.35,
      section: "21.5",
      tags: ["telescoping", "partial-fractions"],
    });
  }
  const gap = pick([2, 3, 4], index);
  const offset = index % 4;
  const terms = 8 + (index % 15);
  const start = offset + 1;
  const answer = telescopeGap(start, terms, gap, 1);
  return buildProblem({
    index,
    topicId,
    difficulty,
    prompt: `Evaluate $\\displaystyle \\sum_{n=1}^{${terms}} \\frac{1}{(n+${offset})(n+${offset + gap})}$.`,
    correct: answer,
    distractors: [telescopeGap(start, terms, gap, gap), telescopeConsecutive(start, terms, 1), telescopeGap(start, terms + 1, gap, 1)],
    answerType: "fraction",
    solution: `Use $\\frac{1}{x(x+${gap})}=\\frac{1}{${gap}}\\left(\\frac{1}{x}-\\frac{1}{x+${gap}}\\right)$. The remaining edge terms give $${answer}$.`,
    complexity: 1.5,
    section: "21.5",
    tags: ["telescoping", "partial-fractions", "starred"],
  });
}

const generators: Record<string, (difficulty: Difficulty, index: number) => Problem> = {
  "ch21.arithmetic_sequences": generateArithmeticSequences,
  "ch21.arithmetic_series": generateArithmeticSeries,
  "ch21.geometric_sequences": generateGeometricSequences,
  "ch21.geometric_series": generateGeometricSeries,
  "ch21.telescoping": generateTelescoping,
};

const outDir = path.join(process.cwd(), "content", "problems", groupId);
fs.mkdirSync(outDir, { recursive: true });

for (const [topicId, generator] of Object.entries(generators)) {
  for (const difficulty of difficulties) {
    const problems = Array.from({ length: 50 }, (_, index) => generator(difficulty, index));
    const filePath = path.join(outDir, `${topicId}.${difficulty}.json`);
    fs.writeFileSync(filePath, JSON.stringify(problems, null, 2) + "\n");
  }
}

console.log(`Generated ${Object.keys(generators).length * difficulties.length * 50} Chapter 21 problems.`);
