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

const GROUP_ID = "ch20_special_functions";
const OUT_DIR = path.join(process.cwd(), "content", "problems", GROUP_ID);
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const IDS = ["a", "b", "c", "d"];

function checksum(problem: Pick<Problem, "topic_id" | "difficulty" | "prompt_latex" | "correct_answer">): string {
  const payload = problem.topic_id + problem.difficulty + problem.prompt_latex + problem.correct_answer;
  return "sha256-" + crypto.createHash("sha256").update(payload).digest("hex");
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function pick(values: number[], index: number): number {
  const base = values[mod(index, values.length)];
  const cycle = Math.floor(Math.abs(index) / values.length);
  if (cycle === 0) return base;
  if (base === 0) return cycle;
  return base + Math.sign(base) * cycle;
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

function fracLatex(value: string): string {
  const [num, den] = value.split("/");
  return `$\\frac{${num}}{${den}}$`;
}

function signed(n: number): string {
  return n < 0 ? `- ${Math.abs(n)}` : `+ ${n}`;
}

function signedCompact(n: number): string {
  return n < 0 ? `-${Math.abs(n)}` : `+${n}`;
}

function lin(a: number, b: number, variable = "x"): string {
  const first = a === 1 ? variable : a === -1 ? `-${variable}` : `${a}${variable}`;
  return b === 0 ? first : `${first} ${signed(b)}`;
}

function compactLin(a: number, b: number, variable = "x"): string {
  const first = a === 1 ? variable : a === -1 ? `-${variable}` : `${a}${variable}`;
  return b === 0 ? first : `${first}${signedCompact(b)}`;
}

function paren(n: number): string {
  return n < 0 ? `(${n})` : `${n}`;
}

function valueLatex(answerType: AnswerType, value: string): string {
  if (answerType === "fraction") return fracLatex(value);
  if (answerType === "string") return `$\\text{${value}}$`;
  return `$${value}$`;
}

function stringChoice(value: string, latex: string): ChoiceInput {
  return { value, latex: `$${latex}$` };
}

function choiceKey(choice: ChoiceInput): string {
  return choice.value.replace(/\s+/g, "").toLowerCase();
}

function uniqueChoices(correct: ChoiceInput, distractors: ChoiceInput[], answerType: AnswerType): ChoiceInput[] {
  const out: ChoiceInput[] = [];
  const seen = new Set<string>();
  for (const choice of [correct, ...distractors]) {
    const key = choiceKey(choice);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(choice);
  }
  let bump = 1;
  while (out.length < 4) {
    const numeric = Number(correct.value);
    const fallback = Number.isFinite(numeric) ? `${numeric + bump}` : `${correct.value}${bump}`;
    const item = { value: fallback, latex: valueLatex(answerType, fallback) };
    const key = choiceKey(item);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
    bump += 1;
  }
  return out.slice(0, 4);
}

function buildProblem(args: {
  index: number;
  topicId: string;
  difficulty: Difficulty;
  section: string;
  prompt: string;
  correct: ChoiceInput;
  distractors: ChoiceInput[];
  answerType: AnswerType;
  acceptedForms?: string[];
  solution: string;
  complexity: number;
  tags: string[];
}): Problem {
  const choices = uniqueChoices(args.correct, args.distractors, args.answerType);
  const shift = mod(args.index * 5 + args.topicId.length + args.difficulty.length, 4);
  const ordered = choices.map((_, j) => choices[mod(j - shift, 4)]);
  const correctIndex = ordered.findIndex((choice) => choice.value === args.correct.value && choiceKey(choice) === choiceKey(args.correct));
  const problem: Problem = {
    id: `${args.topicId}.${args.difficulty}.${String(args.index + 1).padStart(4, "0")}`,
    topic_id: args.topicId,
    group_id: GROUP_ID,
    difficulty: args.difficulty,
    prompt_latex: args.prompt,
    answer_format: "mc",
    choices: ordered.map((choice, i) => ({ id: IDS[i], latex: choice.latex ?? valueLatex(args.answerType, choice.value) })),
    correct_choice: IDS[correctIndex],
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

function radicalChoice(coef: number, rad: number): ChoiceInput {
  const value = coef === 1 ? `sqrt(${rad})` : `${coef}sqrt(${rad})`;
  const latex = coef === 1 ? `$\\sqrt{${rad}}$` : `$${coef}\\sqrt{${rad}}$`;
  return { value, latex };
}

function radicalText(coef: number, rad: number): string {
  return coef === 1 ? `\\sqrt{${rad}}` : `${coef}\\sqrt{${rad}}`;
}

function generateRadicals(difficulty: Difficulty, index: number): Problem {
  const topicId = "ch20.radicals";
  if (difficulty === "easy") {
    if (index % 2 === 0) {
      const coef = 2 + Math.floor(index / 2);
      const rad = pick([2, 3, 5, 6, 7, 10], index * 2 + 1);
      const n = coef * coef * rad;
      return buildProblem({
        index,
        topicId,
        difficulty,
        section: "20.1",
        prompt: `Simplify $\\sqrt{${n}}$.`,
        correct: radicalChoice(coef, rad),
        distractors: [radicalChoice(coef + 1, rad), radicalChoice(coef, rad + 1), stringChoice(`sqrt(${n})`, `\\sqrt{${n}}`)],
        answerType: "string",
        acceptedForms: [radicalText(coef, rad)],
        solution: `Since $${n}=${coef}^2\\cdot ${rad}$, we have $\\sqrt{${n}}=${radicalText(coef, rad)}$.`,
        complexity: 1.0,
        tags: ["radicals", "simplifying"],
      });
    }
    const root = 4 + Math.floor(index / 2);
    return buildProblem({
      index,
      topicId,
      difficulty,
      section: "20.1",
      prompt: `Evaluate $\\sqrt{${root * root}}$.`,
      correct: { value: `${root}` },
      distractors: [{ value: `${-root}` }, { value: `${root * root}` }, { value: `${root + 1}` }],
      answerType: "integer",
      solution: `The radical symbol means the nonnegative square root, so $\\sqrt{${root * root}}=${root}$.`,
      complexity: 0.9,
      tags: ["radicals", "evaluation"],
    });
  }
  if (difficulty === "medium") {
    if (index % 2 === 0) {
      const a = pick([2, 3, 5, 6, 7], index);
      const b = pick([8, 12, 18, 20, 27, 28], index * 3);
      const product = a * b;
      let coef = 1;
      let rad = product;
      for (let s = 12; s >= 2; s--) {
        if (rad % (s * s) === 0) {
          coef *= s;
          rad /= s * s;
        }
      }
      return buildProblem({
        index,
        topicId,
        difficulty,
        section: "20.1",
        prompt: `Simplify $\\sqrt{${a}}\\cdot\\sqrt{${b}}$.`,
        correct: radicalChoice(coef, rad),
        distractors: [radicalChoice(coef + 1, rad), stringChoice(`sqrt(${a + b})`, `\\sqrt{${a + b}}`), stringChoice(`sqrt(${product})`, `\\sqrt{${product}}`)],
        answerType: "string",
        acceptedForms: [radicalText(coef, rad)],
        solution: `$\\sqrt{${a}}\\sqrt{${b}}=\\sqrt{${product}}=${radicalText(coef, rad)}$.`,
        complexity: 1.2,
        tags: ["radicals", "multiplication", "simplifying"],
      });
    }
    const r = pick([4, 5, 6, 7, 8, 9], index);
    const c = pick([-8, -5, -2, 3, 6, 10], index * 2);
    const answer = r * r - c;
    return buildProblem({
      index,
      topicId,
      difficulty,
      section: "20.1",
      prompt: `Solve $\\sqrt{x ${signed(c)}}=${r}$.`,
      correct: { value: `${answer}` },
      distractors: [{ value: `${r - c}` }, { value: `${r * r + c}` }, { value: `${answer + 1}` }],
      answerType: "integer",
      solution: `Squaring gives $x ${signed(c)}=${r * r}$, so $x=${answer}$.`,
      complexity: 1.2,
      tags: ["radicals", "equations"],
    });
  }
  if (index % 2 === 0) {
    const m = pick([2, 3, 5, 6, 7, 8], index);
    const n = pick([1, 2, 3, 4, 5], index * 3 + 1);
    const outer = m + n;
    const inner = m * n;
    return buildProblem({
      index,
      topicId,
      difficulty,
      section: "20.1",
      prompt: `Simplify $\\sqrt{${outer}+2\\sqrt{${inner}}}$.`,
      correct: stringChoice(`sqrt(${m})+sqrt(${n})`, `\\sqrt{${m}}+\\sqrt{${n}}`),
      distractors: [stringChoice(`sqrt(${outer})+sqrt(${inner})`, `\\sqrt{${outer}}+\\sqrt{${inner}}`), stringChoice(`sqrt(${m})-sqrt(${n})`, `\\sqrt{${m}}-\\sqrt{${n}}`), stringChoice(`sqrt(${outer + 2 * inner})`, `\\sqrt{${outer + 2 * inner}}`)],
      answerType: "string",
      acceptedForms: [`\\sqrt{${n}}+\\sqrt{${m}}`],
      solution: `Because $(\\sqrt{${m}}+\\sqrt{${n}})^2=${m}+${n}+2\\sqrt{${m * n}}=${outer}+2\\sqrt{${inner}}$, the radical simplifies to $\\sqrt{${m}}+\\sqrt{${n}}$.`,
      complexity: 1.45,
      tags: ["radicals", "nested radicals"],
    });
  }
  const m = pick([5, 7, 8, 10, 11, 13], index);
  const n = pick([2, 3, 4, 5, 6], index * 2);
  const den = m - n;
  return buildProblem({
    index,
    topicId,
    difficulty,
    section: "20.1",
    prompt: `Rationalize $\\frac{1}{\\sqrt{${m}}+\\sqrt{${n}}}$.`,
    correct: stringChoice(`(sqrt(${m})-sqrt(${n}))/${den}`, `\\frac{\\sqrt{${m}}-\\sqrt{${n}}}{${den}}`),
    distractors: [stringChoice(`(sqrt(${m})+sqrt(${n}))/${den}`, `\\frac{\\sqrt{${m}}+\\sqrt{${n}}}{${den}}`), stringChoice(`sqrt(${m})-sqrt(${n})`, `\\sqrt{${m}}-\\sqrt{${n}}`), stringChoice(`1/${den}`, `\\frac{1}{${den}}`)],
    answerType: "string",
    acceptedForms: [],
    solution: `Multiply by the conjugate: $\\frac{1}{\\sqrt{${m}}+\\sqrt{${n}}}\\cdot\\frac{\\sqrt{${m}}-\\sqrt{${n}}}{\\sqrt{${m}}-\\sqrt{${n}}}=\\frac{\\sqrt{${m}}-\\sqrt{${n}}}{${m}-${n}}$.`,
    complexity: 1.5,
    tags: ["radicals", "rationalizing", "conjugates"],
  });
}

function generateAbsoluteValue(difficulty: Difficulty, index: number): Problem {
  const topicId = "ch20.absolute_value";
  if (difficulty === "easy") {
    if (index % 2 === 0) {
      const x = pick([-8, -6, -4, -1, 2, 5, 7, 9], index);
      const a = pick([-5, -2, 1, 3, 6], index * 2);
      const answer = Math.abs(x - a);
      return buildProblem({
        index,
        topicId,
        difficulty,
        section: "20.2",
        prompt: `Evaluate $|${x} ${signed(-a)}|$.`,
        correct: { value: `${answer}` },
        distractors: [{ value: `${x - a}` }, { value: `${Math.abs(x) - a}` }, { value: `${answer + 1}` }],
        answerType: "integer",
        solution: `$${x} ${signed(-a)}=${x - a}$, so the absolute value is $${answer}$.`,
        complexity: 0.9,
        tags: ["absolute value", "evaluation"],
      });
    }
    const center = pick([-6, -3, -1, 2, 4, 7], index);
    const radius = pick([2, 3, 4, 5, 6], index * 3);
    return buildProblem({
      index,
      topicId,
      difficulty,
      section: "20.2",
      prompt: `Solve $|x ${signed(-center)}|=${radius}$.`,
      correct: stringChoice(`${center - radius}, ${center + radius}`, `${center - radius},\ ${center + radius}`),
      distractors: [stringChoice(`${center + radius}`, `${center + radius}`), stringChoice(`${center - radius}`, `${center - radius}`), stringChoice(`${-center - radius}, ${-center + radius}`, `${-center - radius},\ ${-center + radius}`)],
      answerType: "string",
      acceptedForms: [`${center + radius}, ${center - radius}`],
      solution: `The distance from $x$ to $${center}$ is $${radius}$, so $x=${center - radius}$ or $x=${center + radius}$.`,
      complexity: 1.0,
      tags: ["absolute value", "equations"],
    });
  }
  if (difficulty === "medium") {
    if (index % 2 === 0) {
      const a = pick([2, 3, 4, 5, 6], index);
      const r1 = pick([-5, -3, -1, 2, 4, 6], index * 2);
      const r2 = r1 + pick([4, 6, 8, 10], index * 3);
      const b = -a * r1;
      const c = Math.abs(a * r2 + b);
      return buildProblem({
        index,
        topicId,
        difficulty,
        section: "20.2",
        prompt: `Solve $|${lin(a, b)}|=${c}$.`,
        correct: stringChoice(`${r1}, ${r2}`, `${r1},\ ${r2}`),
        distractors: [stringChoice(`${r1}`, `${r1}`), stringChoice(`${r2}`, `${r2}`), stringChoice(`${-r1}, ${-r2}`, `${-r1},\ ${-r2}`)],
        answerType: "string",
        acceptedForms: [`${r2}, ${r1}`],
        solution: `Set $${lin(a, b)}=${c}$ or $${lin(a, b)}=-${c}$. The two solutions are $x=${r2}$ and $x=${r1}$.`,
        complexity: 1.2,
        tags: ["absolute value", "linear equations"],
      });
    }
    const center = pick([-6, -4, -1, 2, 5], index);
    const radius = pick([2, 3, 4, 5, 6, 7], index * 4);
    return buildProblem({
      index,
      topicId,
      difficulty,
      section: "20.2",
      prompt: `Solve $|x ${signed(-center)}|<${radius}$.`,
      correct: stringChoice(`${center - radius}<x<${center + radius}`, `${center - radius}<x<${center + radius}`),
      distractors: [stringChoice(`x<${center - radius} or x>${center + radius}`, `x<${center - radius}\text{ or }x>${center + radius}`), stringChoice(`${center - radius}<=x<=${center + radius}`, `${center - radius}\\le x\\le ${center + radius}`), stringChoice(`${-center - radius}<x<${-center + radius}`, `${-center - radius}<x<${-center + radius}`)],
      answerType: "string",
      acceptedForms: [],
      solution: `The inequality means $x$ is within $${radius}$ of $${center}$, giving $${center - radius}<x<${center + radius}$.`,
      complexity: 1.2,
      tags: ["absolute value", "inequalities"],
    });
  }
  if (index % 2 === 0) {
    const a = pick([-8, -5, -2, 1, 4], index);
    const b = a + pick([5, 7, 9, 11], index * 2);
    const t = pick([1, 2, 3, 4], index * 3);
    const left = a - t;
    const right = b + t;
    const sum = b - a + 2 * t;
    return buildProblem({
      index,
      topicId,
      difficulty,
      section: "20.2",
      prompt: `Solve $|x ${signed(-a)}|+|x ${signed(-b)}|=${sum}$.`,
      correct: stringChoice(`${left}, ${right}`, `${left},\ ${right}`),
      distractors: [stringChoice(`${a}, ${b}`, `${a},\ ${b}`), stringChoice(`${left}, ${b}`, `${left},\ ${b}`), stringChoice(`${a}, ${right}`, `${a},\ ${right}`)],
      answerType: "string",
      acceptedForms: [`${right}, ${left}`],
      solution: `Outside the interval $[${a},${b}]$, the sum increases by twice the distance from the nearer endpoint. Since $${sum}=(${b}-${a})+2\\cdot ${t}$, the solutions are $${left}$ and $${right}$.`,
      complexity: 1.45,
      tags: ["absolute value", "casework"],
    });
  }
  const a = pick([-9, -6, -3, 0, 2], index);
  const b = a + pick([4, 6, 8], index * 2);
  const c = b + pick([3, 5, 7], index * 3);
  const min = (b - a) + (c - b);
  return buildProblem({
    index,
    topicId,
    difficulty,
    section: "20.2",
    prompt: `What is the minimum value of $|x ${signed(-a)}|+|x ${signed(-b)}|+|x ${signed(-c)}|$?`,
    correct: { value: `${min}` },
    distractors: [{ value: `${c - a + 1}` }, { value: `${b - a}` }, { value: `${c - b}` }],
    answerType: "integer",
    solution: `The sum of distances to three points is minimized at the middle point $x=${b}$. The minimum is $${b - a}+${c - b}=${min}$.`,
    complexity: 1.4,
    tags: ["absolute value", "optimization"],
  });
}

function floorDiv(n: number, d: number): number {
  return Math.floor(n / d);
}

function ceilDiv(n: number, d: number): number {
  return Math.ceil(n / d);
}

function generateFloorCeiling(difficulty: Difficulty, index: number): Problem {
  const topicId = "ch20.floor_ceiling";
  if (difficulty === "easy") {
    const n = pick([-23, -17, -11, -7, 7, 11, 17, 23], index);
    const d = pick([2, 3, 4, 5, 6], index * 2);
    const useFloor = index % 2 === 0;
    const answer = useFloor ? floorDiv(n, d) : ceilDiv(n, d);
    const symbol = useFloor ? ["\\lfloor", "\\rfloor"] : ["\\lceil", "\\rceil"];
    return buildProblem({
      index,
      topicId,
      difficulty,
      section: "20.3",
      prompt: `Evaluate $${symbol[0]}\\frac{${n}}{${d}}${symbol[1]}$.`,
      correct: { value: `${answer}` },
      distractors: [{ value: `${useFloor ? ceilDiv(n, d) : floorDiv(n, d)}` }, { value: `${Math.trunc(n / d)}` }, { value: `${answer + 1}` }],
      answerType: "integer",
      solution: `$\\frac{${n}}{${d}}=${(n / d).toFixed(2)}\\ldots$, so the ${useFloor ? "greatest integer not exceeding it" : "least integer not less than it"} is $${answer}$.`,
      complexity: 0.95,
      tags: ["floor", "ceiling", "evaluation"],
    });
  }
  if (difficulty === "medium") {
    if (index % 2 === 0) {
      const a = pick([2, 3, 4, 5, 6, 7], index);
      const m = pick([-4, -2, 1, 3, 5], index * 3);
      const low = a * m;
      const high = a * m + a - 1;
      return buildProblem({
        index,
        topicId,
        difficulty,
        section: "20.3",
        prompt: `How many integers $n$ satisfy $\\left\\lfloor\\frac{n}{${a}}\\right\\rfloor=${m}$?`,
        correct: { value: `${a}` },
        distractors: [{ value: `${a - 1}` }, { value: `${a + 1}` }, { value: `${Math.abs(m)}` }],
        answerType: "integer",
        solution: `The condition is $${a * m}\\le n<${a * (m + 1)}$, so the integers are $${low}$ through $${high}$, a total of $${a}$.`,
        complexity: 1.2,
        tags: ["floor", "integers", "counting"],
      });
    }
    const a = pick([17, 19, 23, 29, 31], index);
    const b = pick([3, 4, 5, 6], index * 2);
    const c = pick([-22, -17, -13, 14, 19], index * 3);
    const d = pick([2, 3, 4, 5], index * 5);
    const answer = floorDiv(a, b) + ceilDiv(c, d);
    return buildProblem({
      index,
      topicId,
      difficulty,
      section: "20.3",
      prompt: `Evaluate $\\left\\lfloor\\frac{${a}}{${b}}\\right\\rfloor+\\left\\lceil\\frac{${c}}{${d}}\\right\\rceil$.`,
      correct: { value: `${answer}` },
      distractors: [{ value: `${ceilDiv(a, b) + floorDiv(c, d)}` }, { value: `${floorDiv(a, b) + floorDiv(c, d)}` }, { value: `${answer + 1}` }],
      answerType: "integer",
      solution: `$\\left\\lfloor ${a}/${b}\\right\\rfloor=${floorDiv(a, b)}$ and $\\left\\lceil ${c}/${d}\\right\\rceil=${ceilDiv(c, d)}$, so the sum is $${answer}$.`,
      complexity: 1.2,
      tags: ["floor", "ceiling", "evaluation"],
    });
  }
  if (index % 2 === 0) {
    const n = pick([18, 24, 30, 36, 42, 48], index);
    const m = pick([3, 4, 5, 6, 7], index * 2);
    let answer = 0;
    for (let k = 1; k <= n; k++) answer += Math.floor(k / m);
    const q = Math.floor(n / m);
    return buildProblem({
      index,
      topicId,
      difficulty,
      section: "20.3",
      prompt: `Evaluate $\\sum_{k=1}^{${n}}\\left\\lfloor\\frac{k}{${m}}\\right\\rfloor$.`,
      correct: { value: `${answer}` },
      distractors: [{ value: `${answer + q}` }, { value: `${answer - q}` }, { value: `${Math.floor((n * (n + 1)) / (2 * m))}` }],
      answerType: "integer",
      solution: `Group the terms by their quotient when divided by $${m}$. Direct grouping gives the sum $${answer}$.`,
      complexity: 1.45,
      tags: ["floor", "summation", "counting"],
    });
  }
  const a = pick([3, 4, 5, 6], index);
  const b = pick([5, 7, 8, 9], index * 2);
  const limit = pick([30, 36, 42, 48], index * 3);
  let count = 0;
  for (let n = 0; n <= limit; n++) {
    if (Math.floor(n / a) === Math.ceil(n / b)) count += 1;
  }
  return buildProblem({
    index,
    topicId,
    difficulty,
    section: "20.3",
    prompt: `How many integers $n$ with $0\\le n\\le ${limit}$ satisfy $\\left\\lfloor\\frac{n}{${a}}\\right\\rfloor=\\left\\lceil\\frac{n}{${b}}\\right\\rceil$?`,
    correct: { value: `${count}` },
    distractors: [{ value: `${count + 1}` }, { value: `${Math.max(0, count - 1)}` }, { value: `${Math.floor(limit / Math.max(a, b))}` }],
    answerType: "integer",
    solution: `Check each possible common integer value. The corresponding intervals overlap for $${count}$ integer values of $n$ in the given range.`,
    complexity: 1.5,
    tags: ["floor", "ceiling", "counting"],
  });
}

function generateRationalFunctions(difficulty: Difficulty, index: number): Problem {
  const topicId = "ch20.rational_functions";
  if (difficulty === "easy") {
    const a = pick([2, 3, 4, 5, -2], index);
    const b = pick([-5, -2, 1, 4, 7], index * 2);
    const c = pick([1, 2, 3, -1], index * 3);
    const d = pick([-4, -1, 2, 5], index * 5);
    const x = pick([-3, -2, -1, 1, 2, 3, 4], index * 7);
    const den = c * x + d === 0 ? c * x + d + 1 : c * x + d;
    const num = a * x + b;
    const answer = frac(num, den);
    return buildProblem({
      index,
      topicId,
      difficulty,
      section: "20.4",
      prompt: `Let $f(x)=\\frac{${lin(a, b)}}{${lin(c, den - c * x)}}$. Find $f(${x})$.`,
      correct: { value: answer },
      distractors: [{ value: frac(num, den + 1) }, { value: frac(a + x + b, den) }, { value: frac(den, num === 0 ? 1 : num) }],
      answerType: "fraction",
      solution: `Substitution gives $f(${x})=\\frac{${num}}{${den}}=${answer}$.`,
      complexity: 1.0,
      tags: ["rational functions", "evaluation"],
    });
  }
  if (difficulty === "medium") {
    if (index % 2 === 0) {
      const p = 2 + Math.floor(index / 2);
      const q = pick([1, 2, 3, 4, 5], index * 2);
      const expr = compactLin(1, q);
      return buildProblem({
        index,
        topicId,
        difficulty,
        section: "20.4",
        prompt: `For $x\\ne ${p}$, simplify $\\frac{(x ${signed(-p)})(x ${signed(q)})}{x ${signed(-p)}}$.`,
        correct: { value: expr, latex: `$${lin(1, q)}$` },
        distractors: [{ value: compactLin(1, -p), latex: `$${lin(1, -p)}$` }, { value: `(x${signedCompact(-p)})*(x${signedCompact(q)})`, latex: `$(x ${signed(-p)})(x ${signed(q)})$` }, { value: compactLin(1, p + q), latex: `$${lin(1, p + q)}$` }],
        answerType: "expression",
        acceptedForms: [`x${signedCompact(q)}`],
        solution: `Cancel the common factor $x ${signed(-p)}$ to get $${lin(1, q)}$.`,
        complexity: 1.2,
        tags: ["rational functions", "simplifying", "domain restriction"],
      });
    }
    const c = Math.floor(index / 2) - 12;
    return buildProblem({
      index,
      topicId,
      difficulty,
      section: "20.4",
      prompt: `What value of $x$ is excluded from the domain of $f(x)=\\frac{3x+1}{x ${signed(-c)}}$?`,
      correct: { value: `${c}` },
      distractors: [{ value: `${-c}` }, { value: `${c + 1}` }, { value: `${-1}` }],
      answerType: "integer",
      solution: `The denominator cannot be $0$. Solving $x ${signed(-c)}=0$ gives $x=${c}$.`,
      complexity: 1.15,
      tags: ["rational functions", "domain"],
    });
  }
  if (index % 2 === 0) {
    const r = pick([-5, -3, -1, 2, 4, 6], index);
    let s = pick([2, 3, 4, 5, 6], index * 2);
    if (r + s === 0) s += 1;
    const y = r + s;
    return buildProblem({
      index,
      topicId,
      difficulty,
      section: "20.4",
      prompt: `Find the removable hole of $f(x)=\\frac{(x ${signed(-r)})(x ${signed(s)})}{x ${signed(-r)}}$.`,
      correct: { value: `(${r},${y})`, latex: `$(${r},${y})$` },
      distractors: [{ value: `(${r},0)`, latex: `$(${r},0)$` }, { value: `(${-s},0)`, latex: `$(${-s},0)$` }, { value: `(${-s},${y})`, latex: `$(${-s},${y})$` }],
      answerType: "ordered_pair",
      solution: `The canceled factor is zero at $x=${r}$. The simplified function is $x ${signed(s)}$, so the missing point has $y=${r + s}$.`,
      complexity: 1.4,
      tags: ["rational functions", "holes", "simplifying"],
    });
  }
  const a = pick([2, 3, 4, 5], index);
  const b = pick([-5, -2, 1, 3, 6], index * 2);
  const c = pick([-4, -1, 2, 5], index * 3);
  const x = pick([-3, -2, -1, 1, 2, 3, 4], index * 5);
  const y = frac(a * x + b, x - c);
  const [yn, yd] = y.split("/").map(Number);
  const solutionX = x;
  return buildProblem({
    index,
    topicId,
    difficulty,
    section: "20.4",
    prompt: `Let $f(x)=\\frac{${lin(a, b)}}{x ${signed(-c)}}$. If $f(x)=\\frac{${yn}}{${yd}}$, find $x$.`,
    correct: { value: `${solutionX}` },
    distractors: [{ value: `${c}` }, { value: `${solutionX + 1}` }, { value: `${-solutionX}` }],
    answerType: "integer",
    solution: `Cross-multiply $${yd}(${lin(a, b)})=${yn}(x ${signed(-c)})$. Solving gives $x=${solutionX}$.`,
    complexity: 1.45,
    tags: ["rational functions", "equations"],
  });
}

function piecewiseLatex(cut: number, left: string, right: string): string {
  return `f(x)=\\begin{cases}${left},&x<${cut}\\\\${right},&x\\ge ${cut}\\end{cases}`;
}

function generatePiecewise(difficulty: Difficulty, index: number): Problem {
  const topicId = "ch20.piecewise";
  if (difficulty === "easy") {
    const cut = pick([-3, -1, 0, 2, 4], index);
    const a = pick([2, 3, -2, 4], index * 2);
    const b = pick([-5, -2, 1, 3], index * 3);
    const c = pick([1, 2, 3, -1], index * 5);
    const d = pick([-4, -1, 2, 5], index * 7);
    const x = index % 2 === 0 ? cut - pick([1, 2, 3], index) : cut + pick([0, 1, 2, 3], index);
    const answer = x < cut ? a * x + b : c * x + d;
    return buildProblem({
      index,
      topicId,
      difficulty,
      section: "20.5",
      prompt: `Let $${piecewiseLatex(cut, lin(a, b), lin(c, d))}$. Find $f(${x})$.`,
      correct: { value: `${answer}` },
      distractors: [{ value: `${x < cut ? c * x + d : a * x + b}` }, { value: `${answer + 1}` }, { value: `${answer - 1}` }],
      answerType: "integer",
      solution: `Since $${x}${x < cut ? "<" : "\\ge"}${cut}$, use the ${x < cut ? "first" : "second"} rule to get $f(${x})=${answer}$.`,
      complexity: 1.0,
      tags: ["piecewise", "evaluation"],
    });
  }
  if (difficulty === "medium") {
    if (index % 2 === 0) {
      const cut = pick([-3, -1, 1, 3, 5], index);
      const a = pick([2, 3, -2, 4], index * 2);
      const b = pick([-6, -2, 1, 5], index * 3);
      const m = pick([1, 2, 3, -1], index * 5);
      const needed = a * cut + b - m * cut;
      return buildProblem({
        index,
        topicId,
        difficulty,
        section: "20.5",
        prompt: `For what value of $a$ is $f(x)=\\begin{cases}${lin(a, b)},&x<${cut}\\\\${m}x+a,&x\\ge ${cut}\\end{cases}$ continuous at $x=${cut}$?`,
        correct: { value: `${needed}` },
        distractors: [{ value: `${needed + 1}` }, { value: `${a * cut + b}` }, { value: `${m * cut}` }],
        answerType: "integer",
        solution: `Continuity requires the two formulas to agree at $x=${cut}$: $${a * cut + b}=${m * cut}+a$, so $a=${needed}$.`,
        complexity: 1.25,
        tags: ["piecewise", "continuity", "parameters"],
      });
    }
    const cut = pick([-2, 0, 1, 3], index);
    const leftRoot = cut - pick([1, 2, 3, 4], index * 2);
    const rightRoot = cut + pick([0, 1, 2, 3], index * 3);
    const target = pick([-4, -1, 2, 5], index * 5);
    return buildProblem({
      index,
      topicId,
      difficulty,
      section: "20.5",
      prompt: `Let $f(x)=\\begin{cases}x ${signed(target - leftRoot)},&x<${cut}\\\\x ${signed(target - rightRoot)},&x\\ge ${cut}\\end{cases}$. Solve $f(x)=${target}$.`,
      correct: stringChoice(`${leftRoot}, ${rightRoot}`, `${leftRoot},\ ${rightRoot}`),
      distractors: [stringChoice(`${leftRoot}`, `${leftRoot}`), stringChoice(`${rightRoot}`, `${rightRoot}`), stringChoice(`${cut}`, `${cut}`)],
      answerType: "string",
      acceptedForms: [`${rightRoot}, ${leftRoot}`],
      solution: `Solve each branch and keep only values in that branch's domain. This gives $x=${leftRoot}$ and $x=${rightRoot}$.`,
      complexity: 1.25,
      tags: ["piecewise", "equations"],
    });
  }
  if (index % 2 === 0) {
    const cut = pick([-2, -1, 0, 1, 2], index);
    const a = pick([2, 3, -2, 4], index * 2);
    const b = pick([-5, -1, 2, 6], index * 3);
    const c = pick([1, 2, 3, -1], index * 5);
    const d = pick([-4, 0, 3, 5], index * 7);
    const x = cut - pick([1, 2, 3], index);
    const first = a * x + b;
    const answer = first < cut ? a * first + b : c * first + d;
    return buildProblem({
      index,
      topicId,
      difficulty,
      section: "20.5",
      prompt: `Let $${piecewiseLatex(cut, lin(a, b), lin(c, d))}$. Find $f(f(${x}))$.`,
      correct: { value: `${answer}` },
      distractors: [{ value: `${first}` }, { value: `${answer + 1}` }, { value: `${c * x + d}` }],
      answerType: "integer",
      solution: `First $f(${x})=${first}$. Then choose the branch containing $${first}$ to get $f(f(${x}))=${answer}$.`,
      complexity: 1.4,
      tags: ["piecewise", "composition", "evaluation"],
    });
  }
  const cut = pick([-3, -1, 0, 2, 4], index);
  const leftA = pick([1, 2, 3], index * 2);
  const target = pick([4, 6, 9, 12, 16], index * 3);
  let count = 0;
  for (let x = -20; x <= 20; x++) {
    const value = x < cut ? leftA * (x - cut) * (x - cut) : x - cut + target;
    if (value === target) count += 1;
  }
  return buildProblem({
    index,
    topicId,
    difficulty,
    section: "20.5",
    prompt: `How many real solutions does $f(x)=${target}$ have if $f(x)=\\begin{cases}${leftA}(x ${signed(-cut)})^2,&x<${cut}\\\\x ${signed(target - cut)},&x\\ge ${cut}\\end{cases}$?`,
    correct: { value: `${count}` },
    distractors: [{ value: `${count + 1}` }, { value: `${Math.max(0, count - 1)}` }, { value: "2" }],
    answerType: "integer",
    solution: `The quadratic branch reaches $${target}$ on the left only when its solution is less than $${cut}$; the linear branch gives one solution on the right. Counting valid branch solutions gives $${count}$.`,
    complexity: 1.45,
    tags: ["piecewise", "equations", "casework"],
  });
}

const generators: Record<string, (difficulty: Difficulty, index: number) => Problem> = {
  "ch20.radicals": generateRadicals,
  "ch20.absolute_value": generateAbsoluteValue,
  "ch20.floor_ceiling": generateFloorCeiling,
  "ch20.rational_functions": generateRationalFunctions,
  "ch20.piecewise": generatePiecewise,
};

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const [topicId, generator] of Object.entries(generators)) {
  for (const difficulty of DIFFICULTIES) {
    const problems = Array.from({ length: 50 }, (_, index) => generator(difficulty, index));
    const filePath = path.join(OUT_DIR, `${topicId}.${difficulty}.json`);
    fs.writeFileSync(filePath, JSON.stringify(problems, null, 2) + "\n");
  }
}

console.log(`Wrote ${Object.keys(generators).length * DIFFICULTIES.length * 50} Chapter 20 problems.`);
