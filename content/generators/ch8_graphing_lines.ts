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

const GROUP_ID = "ch8_graphing_lines";
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const COUNT = 50;

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

function createRng(seed: string): () => number {
  const [a, b, c, d] = cyrb128(seed);
  return sfc32(a, b, c, d);
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function choice<T>(rng: () => number, arr: T[]): T {
  return arr[randInt(rng, 0, arr.length - 1)];
}

function shuffle<T>(rng: () => number, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function gcd(a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error(`bad gcd input ${a}, ${b}`);
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

function reduce(n: number, d: number): { n: number; d: number } {
  if (d === 0) throw new Error("zero denominator");
  const g = gcd(n, d);
  n /= g;
  d /= g;
  if (d < 0) {
    n = -n;
    d = -d;
  }
  return { n, d };
}

function fracAnswer(n: number, d: number): string {
  const f = reduce(n, d);
  return `${f.n}/${f.d}`;
}

function fracLatex(n: number, d: number): string {
  const f = reduce(n, d);
  return `\\frac{${f.n}}{${f.d}}`;
}

function gcdAbs(nums: number[]): number {
  return nums.reduce((acc, n) => gcd(acc, n), 0);
}

function wrap(math: string): string {
  return `$${math}$`;
}

function pair(x: number, y: number): string {
  return `(${x},${y})`;
}

function pointLatex(x: number, y: number): string {
  return wrap(`(${x}, ${y})`);
}

function signed(n: number): string {
  return n >= 0 ? `+ ${n}` : `- ${Math.abs(n)}`;
}

function yExpr(m: number, b: number): string {
  let mx: string;
  if (m === 0) mx = "0";
  else if (m === 1) mx = "x";
  else if (m === -1) mx = "-x";
  else mx = `${m}x`;
  if (b === 0) return mx;
  return `${mx} ${signed(b)}`;
}

function equationLatex(m: number, b: number): string {
  return `y = ${yExpr(m, b)}`;
}

function equationAnswer(m: number, b: number): string {
  return equationLatex(m, b).replace(/\s+/g, "");
}

function equationFromStandard(a: number, b: number, c: number): { mNum: number; mDen: number; bNum: number; bDen: number } {
  return {
    mNum: -a,
    mDen: b,
    bNum: c,
    bDen: b,
  };
}

function lineLatexFromSlopeIntercept(mNum: number, mDen: number, bNum: number, bDen: number): string {
  const m = reduce(mNum, mDen);
  const b = reduce(bNum, bDen);
  const slope = m.d === 1 ? (m.n === 1 ? "x" : m.n === -1 ? "-x" : `${m.n}x`) : `${fracLatex(m.n, m.d)}x`;
  if (b.n === 0) return `y = ${slope}`;
  const intercept = b.d === 1 ? `${Math.abs(b.n)}` : fracLatex(Math.abs(b.n), b.d);
  return `y = ${slope} ${b.n > 0 ? "+" : "-"} ${intercept}`;
}

function computeChecksum(problem: Partial<Problem>): string {
  const payload =
    (problem.topic_id ?? "") +
    (problem.difficulty ?? "") +
    (problem.prompt_latex ?? "") +
    (problem.correct_answer ?? "");
  return "sha256-" + crypto.createHash("sha256").update(payload).digest("hex");
}

function stripMath(latex: string): string {
  return latex.trim().replace(/^\$(.*)\$$/, "$1").trim();
}

function canonical(latexOrAnswer: string, answerType: AnswerType): string {
  const s = stripMath(latexOrAnswer).replace(/\s+/g, "");
  if (answerType === "integer") return String(Number(s));
  if (answerType === "fraction") {
    const cleaned = s.replace(/^\\(?:dfrac|frac)\{([^}]+)\}\{([^}]+)\}$/, "$1/$2");
    const [n, d] = cleaned.split("/").map(Number);
    if (!Number.isFinite(n) || !Number.isFinite(d)) throw new Error(`bad fraction ${latexOrAnswer}`);
    const f = reduce(n, d);
    return `${f.n}/${f.d}`;
  }
  if (answerType === "ordered_pair") return s.replace(/^\((.*)\)$/, "$1");
  return s.toLowerCase();
}

function makeChoices(
  correctLatex: string,
  correctAnswer: string,
  answerType: AnswerType,
  distractorLatex: string[],
  rng: () => number
): { choices: Choice[]; correct_choice: string } {
  const seen = new Set<string>([canonical(correctAnswer, answerType)]);
  const distractors: string[] = [];
  for (const d of distractorLatex) {
    const key = canonical(d, answerType);
    if (!seen.has(key)) {
      seen.add(key);
      distractors.push(d);
    }
    if (distractors.length === 3) break;
  }
  if (distractors.length !== 3) throw new Error(`needed 3 distractors for ${correctAnswer}`);
  const raw = [{ latex: correctLatex, correct: true }, ...distractors.map((latex) => ({ latex, correct: false }))];
  shuffle(rng, raw);
  const ids = ["a", "b", "c", "d"];
  const choices = raw.map((c, i) => ({ id: ids[i], latex: c.latex }));
  const correct_choice = ids[raw.findIndex((c) => c.correct)];
  return { choices, correct_choice };
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
  rng: () => number
): Problem {
  const mc = makeChoices(correctLatex, correctAnswer, answerType, distractors, rng);
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
    accepted_forms: [],
    solution_latex: solution,
    complexity_factor: complexity,
    source_section: source,
    tags,
    checksum: "",
    status: "valid",
  };
  problem.checksum = computeChecksum(problem);
  return problem;
}

function intChoices(ans: number): string[] {
  const vals = [ans + 1, ans - 1, -ans, ans + 2, ans - 2, ans * 2, ans + 5, ans - 5];
  return vals.filter((v, i) => Number.isInteger(v) && vals.indexOf(v) === i && v !== ans).map((v) => wrap(String(v)));
}

function fracChoices(n: number, d: number): string[] {
  const ans = canonical(fracAnswer(n, d), "fraction");
  const vals = [
    reduce(-n, d),
    reduce(n, -d),
    reduce(d, n || 1),
    reduce(n + 1, d),
    reduce(n - 1, d),
    reduce(n, d + 1 === 0 ? d - 2 : d + 1),
    reduce(n, d - 1 === 0 ? d + 2 : d - 1),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of vals) {
    const key = `${f.n}/${f.d}`;
    if (key !== ans && !seen.has(key)) {
      seen.add(key);
      out.push(wrap(fracLatex(f.n, f.d)));
    }
  }
  return out;
}

function pairChoices(x: number, y: number): string[] {
  return [
    pointLatex(y, x),
    pointLatex(-x, y),
    pointLatex(x, -y),
    pointLatex(x + 1, y),
    pointLatex(x, y - 1),
    pointLatex(x + 1, y + 1),
  ];
}

function quadrant(x: number, y: number): string {
  if (x > 0 && y > 0) return "I";
  if (x < 0 && y > 0) return "II";
  if (x < 0 && y < 0) return "III";
  return "IV";
}

function genNumberLinePlane(difficulty: Difficulty, index: number, rng: () => number): Problem {
  const topic = "ch8.number_line_plane";
  const source = "8.1";
  const k = index - 1;
  if (difficulty === "easy") {
    const t = k % 5;
    const x = (k % 2 === 0 ? 1 : -1) * (2 + (k % 8));
    const y = (Math.floor(k / 2) % 2 === 0 ? 1 : -1) * (1 + ((k * 3) % 7));
    if (t === 0) {
      const ans = quadrant(x, y);
      return makeProblem(index, topic, difficulty, source, `In which quadrant is the point $(${x}, ${y})$?`, ans, ans, "string", ["I", "II", "III", "IV"], `The signs are $x ${x > 0 ? ">" : "<"} 0$ and $y ${y > 0 ? ">" : "<"} 0$, so the point is in Quadrant ${ans}.`, 1.0, ["coordinate-plane", "quadrants"], rng);
    }
    if (t === 1) {
      const ans = pair(x, -y);
      return makeProblem(index, topic, difficulty, source, `Reflect the point $(${x}, ${y})$ across the $x$-axis.`, pointLatex(x, -y), ans, "ordered_pair", pairChoices(x, -y), `Reflection across the $x$-axis keeps $x$ and changes $y$ to $-y$, giving $(${x}, ${-y})$.`, 1.0, ["coordinate-plane", "reflection"], rng);
    }
    if (t === 2) {
      const ans = pair(-x, y);
      return makeProblem(index, topic, difficulty, source, `Reflect the point $(${x}, ${y})$ across the $y$-axis.`, pointLatex(-x, y), ans, "ordered_pair", pairChoices(-x, y), `Reflection across the $y$-axis changes $x$ to $-x$ and keeps $y$, giving $(${-x}, ${y})$.`, 1.0, ["coordinate-plane", "reflection"], rng);
    }
    if (t === 3) {
      const a = -10 + k;
      const b = a + 3 + (k % 9);
      const ans = Math.abs(b - a);
      return makeProblem(index, topic, difficulty, source, `What is the distance between $${a}$ and $${b}$ on the number line?`, wrap(String(ans)), String(ans), "integer", intChoices(ans), `Distance on a number line is absolute difference: $|${b} - (${a})| = ${ans}$.`, 0.95, ["number-line", "distance"], rng);
    }
    const dx = (k % 5) + 1;
    const dy = -((k % 4) + 1);
    const ans = pair(x + dx, y + dy);
    return makeProblem(index, topic, difficulty, source, `Starting at $(${x}, ${y})$, move ${dx} units right and ${Math.abs(dy)} units down. What point do you reach?`, pointLatex(x + dx, y + dy), ans, "ordered_pair", pairChoices(x + dx, y + dy), `Moving right adds to $x$ and moving down subtracts from $y$: $(${x}+${dx}, ${y}${dy}) = (${x + dx}, ${y + dy})$.`, 1.0, ["coordinate-plane", "translation"], rng);
  }
  if (difficulty === "medium") {
    const t = k % 5;
    const batch = Math.floor(k / 25);
    const x1 = -8 + (k % 9) + 11 * batch;
    const y1 = -7 + ((k * 2) % 9) - 9 * batch;
    const x2 = x1 + 2 * (2 + (k % 5));
    const y2 = y1 + 2 * (1 + ((k + 1) % 5));
    if (t === 0) {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      return makeProblem(index, topic, difficulty, source, `What is the midpoint of the segment from $(${x1}, ${y1})$ to $(${x2}, ${y2})$?`, pointLatex(mx, my), pair(mx, my), "ordered_pair", pairChoices(mx, my), `Average the coordinates: $\\left(\\frac{${x1}+${x2}}{2}, \\frac{${y1}+${y2}}{2}\\right) = (${mx}, ${my})$.`, 1.12, ["coordinate-plane", "midpoint"], rng);
    }
    if (t === 1) {
      return makeProblem(index, topic, difficulty, source, `Three vertices of an axis-aligned rectangle are $(${x1}, ${y1})$, $(${x2}, ${y1})$, and $(${x1}, ${y2})$. What is the fourth vertex?`, pointLatex(x2, y2), pair(x2, y2), "ordered_pair", pairChoices(x2, y2), `The missing corner uses the unused $x$-coordinate and unused $y$-coordinate, so it is $(${x2}, ${y2})$.`, 1.1, ["coordinate-plane", "rectangle"], rng);
    }
    if (t === 2) {
      const area = Math.abs((x2 - x1) * (y2 - y1));
      return makeProblem(index, topic, difficulty, source, `An axis-aligned rectangle has opposite vertices $(${x1}, ${y1})$ and $(${x2}, ${y2})$. What is its area?`, wrap(String(area)), String(area), "integer", intChoices(area), `The side lengths are $|${x2}-${x1}|=${Math.abs(x2 - x1)}$ and $|${y2}-${y1}|=${Math.abs(y2 - y1)}$, so the area is $${area}$.`, 1.12, ["coordinate-plane", "area"], rng);
    }
    if (t === 3) {
      const ans = Math.abs(y1);
      return makeProblem(index, topic, difficulty, source, `What is the distance from $(${x1}, ${y1})$ to the $x$-axis?`, wrap(String(ans)), String(ans), "integer", intChoices(ans), `Distance to the $x$-axis is $|y|$, so the distance is $|${y1}|=${ans}$.`, 1.05, ["coordinate-plane", "distance"], rng);
    }
    const rx = -x1;
    const ry = -y1;
    const ans = pair(rx + 2, ry - 3);
    return makeProblem(index, topic, difficulty, source, `Reflect $(${x1}, ${y1})$ across the origin, then move $2$ units right and $3$ units down. What point results?`, pointLatex(rx + 2, ry - 3), ans, "ordered_pair", pairChoices(rx + 2, ry - 3), `Reflecting across the origin gives $(${-x1}, ${-y1})$. Moving gives $(${-x1}+2, ${-y1}-3)=(${rx + 2}, ${ry - 3})$.`, 1.14, ["coordinate-plane", "reflection", "translation"], rng);
  }
  const t = k % 5;
  const x1 = -6 + (k % 7);
  const y1 = -5 + ((k * 2) % 7);
  const w = 3 + (k % 6);
  const h = 2 * (2 + ((k + 1) % 5));
  if (t === 0) {
    const area = (w * h) / 2;
    return makeProblem(index, topic, difficulty, source, `The points $(${x1}, ${y1})$, $(${x1 + w}, ${y1})$, and $(${x1}, ${y1 + h})$ are vertices of a triangle. What is its area?`, wrap(String(area)), String(area), "integer", intChoices(area), `The legs have lengths $${w}$ and $${h}$, so the area is $\\frac{1}{2}(${w})(${h})=${area}$.`, 1.25, ["coordinate-plane", "area", "triangle"], rng);
  }
  if (t === 1) {
    const perimeter = 2 * (w + h);
    return makeProblem(index, topic, difficulty, source, `An axis-aligned rectangle has opposite vertices $(${x1}, ${y1})$ and $(${x1 + w}, ${y1 + h})$. What is its perimeter?`, wrap(String(perimeter)), String(perimeter), "integer", intChoices(perimeter), `The side lengths are $${w}$ and $${h}$, so the perimeter is $2(${w}+${h})=${perimeter}$.`, 1.22, ["coordinate-plane", "perimeter"], rng);
  }
  if (t === 2) {
    const a = -12 + k;
    const b = a + 3 * (2 + (k % 5));
    const p = a + (2 * (b - a)) / 3;
    return makeProblem(index, topic, difficulty, source, `Point $P$ lies between $${a}$ and $${b}$ on a number line, and $AP:PB=2:1$. What is the coordinate of $P$?`, wrap(String(p)), String(p), "integer", intChoices(p), `The whole interval has length $${b - a}$. Since $AP$ is $\\frac{2}{3}$ of it, $P=${a}+\\frac{2}{3}(${b - a})=${p}$.`, 1.28, ["number-line", "ratio"], rng);
  }
  if (t === 3) {
    const dx = 2 + (k % 4);
    const dy = 1 + ((k + 2) % 4);
    const ax = x1;
    const ay = y1;
    const bx = ax + dx;
    const by = ay + dy;
    const cx = bx - dy;
    const cy = by + dx;
    const dx4 = ax - dy;
    const dy4 = ay + dx;
    return makeProblem(index, topic, difficulty, source, `Consecutive vertices of a square are $(${ax}, ${ay})$, $(${bx}, ${by})$, and $(${cx}, ${cy})$. What is the fourth vertex?`, pointLatex(dx4, dy4), pair(dx4, dy4), "ordered_pair", pairChoices(dx4, dy4), `The side vector $(${dx}, ${dy})$ turns to $(${-dy}, ${dx})$, so the fourth vertex is $(${ax}${-dy >= 0 ? "+" : ""}${-dy}, ${ay}+${dx})=(${dx4}, ${dy4})$.`, 1.3, ["coordinate-plane", "square"], rng);
  }
  const count = (w + 1) * (h + 1);
  return makeProblem(index, topic, difficulty, source, `How many lattice points are inside or on the boundary of the rectangle $${x1} \\le x \\le ${x1 + w}$, $${y1} \\le y \\le ${y1 + h}$?`, wrap(String(count)), String(count), "integer", intChoices(count), `There are $${w}+1$ integer $x$-values and $${h}+1$ integer $y$-values, for $(${w + 1})(${h + 1})=${count}$ points.`, 1.25, ["coordinate-plane", "lattice-points"], rng);
}

function genIntroGraphing(difficulty: Difficulty, index: number, rng: () => number): Problem {
  const topic = "ch8.intro_graphing_linear";
  const source = "8.2";
  const k = index - 1;
  const m = choice(rng, [-3, -2, -1, 1, 2, 3]);
  const b = -6 + (k % 13);
  const x = -5 + ((k * 2) % 11);
  const y = m * x + b;
  if (difficulty === "easy") {
    const t = k % 4;
    if (t === 0) {
      return makeProblem(index, topic, difficulty, source, `Which point lies on the graph of $${equationLatex(m, b)}$?`, pointLatex(x, y), pair(x, y), "ordered_pair", [pointLatex(x, y + 1), pointLatex(x + 1, y), pointLatex(y, x), pointLatex(x, -y)], `Substituting $x=${x}$ gives $y=${m}(${x})${signed(b)}=${y}$, so $(${x}, ${y})$ is on the line.`, 1.0, ["linear-equations", "graphing", "points"], rng);
    }
    if (t === 1) {
      return makeProblem(index, topic, difficulty, source, `On the line $${equationLatex(m, b)}$, what is $y$ when $x=${x}$?`, wrap(String(y)), String(y), "integer", intChoices(y), `Substitute $x=${x}$: $y=${m}(${x})${signed(b)}=${y}$.`, 1.0, ["linear-equations", "substitution"], rng);
    }
    if (t === 2) {
      const cleanX = x;
      const cleanY = m * cleanX + b;
      return makeProblem(index, topic, difficulty, source, `On the line $${equationLatex(m, b)}$, what is $x$ when $y=${cleanY}$?`, wrap(String(cleanX)), String(cleanX), "integer", intChoices(cleanX), `Solve $${cleanY}=${m}x${signed(b)}$ to get $x=${cleanX}$.`, 1.05, ["linear-equations", "substitution"], rng);
    }
    const x0 = 0;
    return makeProblem(index, topic, difficulty, source, `What point does the line $${equationLatex(m, b)}$ have when $x=0$?`, pointLatex(x0, b), pair(x0, b), "ordered_pair", pairChoices(x0, b), `At $x=0$, $y=${m}(0)${signed(b)}=${b}$, so the point is $(0, ${b})$.`, 1.0, ["linear-equations", "graphing", "intercept"], rng);
  }
  if (difficulty === "medium") {
    const t = k % 5;
    const a = choice(rng, [2, 3, 4, 5]);
    const bb = choice(rng, [2, 3, 4, 5]);
    const px = -4 + (k % 9);
    const py = -3 + ((k * 3) % 7);
    const c = a * px + bb * py;
    if (t === 0) {
      const ans = pair(0, b);
      return makeProblem(index, topic, difficulty, source, `What is the $y$-intercept point of the line $${equationLatex(m, b)}$?`, pointLatex(0, b), ans, "ordered_pair", pairChoices(0, b), `The $y$-intercept occurs when $x=0$, so the point is $(0, ${b})$.`, 1.12, ["linear-equations", "intercepts"], rng);
    }
    if (t === 1) {
      const c2 = a * px + bb * py;
      const ans = pair(px, py);
      return makeProblem(index, topic, difficulty, source, `Which point lies on $${a}x + ${bb}y = ${c2}$?`, pointLatex(px, py), ans, "ordered_pair", [pointLatex(px, py + 1), pointLatex(px + 1, py), pointLatex(-px, py), pointLatex(py, px)], `Check $(${px}, ${py})$: $${a}(${px})+${bb}(${py})=${c2}$, so it lies on the line.`, 1.13, ["linear-equations", "standard-form", "points"], rng);
    }
    if (t === 2) {
      const ansY = (c - a * px) / bb;
      return makeProblem(index, topic, difficulty, source, `The point $(${px}, y)$ lies on $${a}x + ${bb}y = ${c}$. What is $y$?`, wrap(String(ansY)), String(ansY), "integer", intChoices(ansY), `Substitute $x=${px}$: $${a}(${px})+${bb}y=${c}$, so $y=${ansY}$.`, 1.15, ["linear-equations", "standard-form", "substitution"], rng);
    }
    if (t === 3) {
      const pts = [x - 1, x, x + 1, x + 2];
      const valid = pts.filter((xx) => m * xx + b >= -20 && m * xx + b <= 20).length;
      return makeProblem(index, topic, difficulty, source, `For how many integers $x$ in $\\{${pts.join(", ")}\\}$ does the point $(x, ${m}x${signed(b)})$ lie on $${equationLatex(m, b)}$?`, wrap(String(valid)), String(valid), "integer", [wrap("1"), wrap("2"), wrap("3"), wrap("4")], `Each point is built by using $y=${m}x${signed(b)}$, so all $${valid}$ listed values give points on the line.`, 1.1, ["linear-equations", "graphing"], rng);
    }
    const ans = pair(px, a * px + b);
    return makeProblem(index, topic, difficulty, source, `A graph of $${equationLatex(a, b)}$ is drawn. Which plotted point should be on the graph when $x=${px}$?`, pointLatex(px, a * px + b), ans, "ordered_pair", pairChoices(px, a * px + b), `Using $x=${px}$ gives $y=${a}(${px})${signed(b)}=${a * px + b}$, so the point is $${ans}$.`, 1.12, ["linear-equations", "graphing", "points"], rng);
  }
  const t = k % 5;
  const xAns = -4 + (k % 9);
  const yAns = -5 + ((k * 4) % 11);
  const m1 = choice(rng, [-3, -2, -1, 1, 2, 3]);
  const m2 = m1 + choice(rng, [-2, -1, 1, 2]);
  const b1 = yAns - m1 * xAns;
  const b2 = yAns - m2 * xAns;
  if (t === 0) {
    return makeProblem(index, topic, difficulty, source, `What is the intersection point of $${equationLatex(m1, b1)}$ and $${equationLatex(m2, b2)}$?`, pointLatex(xAns, yAns), pair(xAns, yAns), "ordered_pair", pairChoices(xAns, yAns), `Both equations give $y=${yAns}$ when $x=${xAns}$, so the intersection is $(${xAns}, ${yAns})$.`, 1.28, ["linear-equations", "intersection"], rng);
  }
  if (t === 1) {
    const yy = m * xAns + b;
    return makeProblem(index, topic, difficulty, source, `The point $(k, ${yy})$ lies on $${equationLatex(m, b)}$. What is $k$?`, wrap(String(xAns)), String(xAns), "integer", intChoices(xAns), `Solve $${yy}=${m}k${signed(b)}$ to get $k=${xAns}$.`, 1.25, ["linear-equations", "parameters"], rng);
  }
  if (t === 2) {
    const a = 2 + (k % 5);
    const bb = 3 + ((k + 1) % 4);
    const c = a * xAns + bb * yAns;
    return makeProblem(index, topic, difficulty, source, `The point $(${xAns}, k)$ lies on $${a}x + ${bb}y = ${c}$. What is $k$?`, wrap(String(yAns)), String(yAns), "integer", intChoices(yAns), `Substitute $x=${xAns}$: $${a}(${xAns})+${bb}k=${c}$, so $k=${yAns}$.`, 1.25, ["linear-equations", "parameters", "standard-form"], rng);
  }
  if (t === 3) {
    const xmin = -3;
    const xmax = 3 + (k % 4);
    const count = xmax - xmin + 1;
    return makeProblem(index, topic, difficulty, source, `How many integer points on $${equationLatex(m, b)}$ have integer $x$ with $${xmin} \\le x \\le ${xmax}$?`, wrap(String(count)), String(count), "integer", intChoices(count), `For every integer $x$ in the interval, $y=${m}x${signed(b)}$ is an integer. There are $${count}$ such $x$-values.`, 1.24, ["linear-equations", "integer-points"], rng);
  }
  const x0 = -b / m;
  const intAns = Math.trunc(x0);
  const cleanB = -m * intAns;
  return makeProblem(index, topic, difficulty, source, `What is the $x$-intercept point of the line $${equationLatex(m, cleanB)}$?`, pointLatex(intAns, 0), pair(intAns, 0), "ordered_pair", pairChoices(intAns, 0), `Set $y=0$: $0=${m}x${signed(cleanB)}$, so $x=${intAns}$ and the point is $(${intAns}, 0)$.`, 1.25, ["linear-equations", "intercepts"], rng);
}

function genSlopeProblems(difficulty: Difficulty, index: number, rng: () => number): Problem {
  const topic = "ch8.slope_in_problems";
  const source = "8.3";
  const k = index - 1;
  const x1 = -6 + (k % 9);
  const y1 = -8 + ((k * 3) % 13);
  const run = choice(rng, [2, 3, 4, 5, 6, 7]);
  const rise = choice(rng, [-9, -7, -5, -4, -3, 3, 4, 5, 7, 9]);
  const x2 = x1 + run;
  const y2 = y1 + rise;
  const f = reduce(rise, run);
  if (difficulty === "easy") {
    const t = k % 4;
    if (t === 0) {
      return makeProblem(index, topic, difficulty, source, `Find the slope of the line through $(${x1}, ${y1})$ and $(${x2}, ${y2})$.`, wrap(fracLatex(f.n, f.d)), fracAnswer(rise, run), "fraction", fracChoices(rise, run), `Slope is $\\frac{\\Delta y}{\\Delta x}=\\frac{${y2}-${y1}}{${x2}-${x1}}=${fracLatex(f.n, f.d)}$.`, 1.05, ["slope", "coordinate-plane"], rng);
    }
    if (t === 1) {
      return makeProblem(index, topic, difficulty, source, `Starting at $(${x1}, ${y1})$, a line rises $${Math.abs(rise)}$ units ${rise > 0 ? "up" : "down"} while moving $${run}$ units right. What is its slope?`, wrap(fracLatex(f.n, f.d)), fracAnswer(rise, run), "fraction", fracChoices(rise, run), `Slope is rise over run, so $m=${fracLatex(rise, run)}=${fracLatex(f.n, f.d)}$.`, 1.0, ["slope", "rise-run"], rng);
    }
    if (t === 2) {
      const rate = 2 + (k % 9);
      const hours = 2 + ((k + 1) % 5);
      const total = rate * hours;
      return makeProblem(index, topic, difficulty, source, `A graph of distance versus time rises $${total}$ miles over $${hours}$ hours. What is the slope in miles per hour?`, wrap(String(rate)), String(rate), "integer", intChoices(rate), `The slope is $\\frac{${total}}{${hours}}=${rate}$ miles per hour.`, 1.0, ["slope", "rate"], rng);
    }
    const y = y1 + f.n * 3;
    return makeProblem(index, topic, difficulty, source, `A line has slope $${f.n}$ and passes through $(${x1}, ${y1})$. What is $y$ when $x=${x1 + 3}$?`, wrap(String(y)), String(y), "integer", intChoices(y), `A slope of $${f.n}$ means $y$ changes by $${f.n}$ for each $1$ in $x$. Moving $3$ right gives $${y1}+3(${f.n})=${y}$.`, 1.05, ["slope", "rate-of-change"], rng);
  }
  if (difficulty === "medium") {
    const t = k % 5;
    if (t === 0) {
      return makeProblem(index, topic, difficulty, source, `Find the slope of the line through $(${x1}, ${y1})$ and $(${x2}, ${y2})$.`, wrap(fracLatex(f.n, f.d)), fracAnswer(rise, run), "fraction", fracChoices(rise, run), `Using $m=\\frac{y_2-y_1}{x_2-x_1}$ gives $m=\\frac{${y2}-${y1}}{${x2}-${x1}}=${fracLatex(f.n, f.d)}$.`, 1.15, ["slope", "coordinate-plane"], rng);
    }
    if (t === 1) {
      const m = choice(rng, [-3, -2, -1, 2, 3, 4]);
      const xB = x1 + choice(rng, [2, 3, 4]);
      const yB = y1 + m * (xB - x1);
      return makeProblem(index, topic, difficulty, source, `The slope from $(${x1}, ${y1})$ to $(${xB}, y)$ is $${m}$. What is $y$?`, wrap(String(yB)), String(yB), "integer", intChoices(yB), `Use $${m}=\\frac{y-${y1}}{${xB}-${x1}}$. Thus $y-${y1}=${m * (xB - x1)}$, so $y=${yB}$.`, 1.16, ["slope", "unknown-coordinate"], rng);
    }
    if (t === 2) {
      const pages = 15 + (k % 9) * 3;
      const mins = 3 + (k % 6);
      const rate = reduce(pages, mins);
      return makeProblem(index, topic, difficulty, source, `A reading graph shows $${pages}$ pages read in $${mins}$ minutes. What is the slope in pages per minute?`, wrap(fracLatex(rate.n, rate.d)), fracAnswer(pages, mins), "fraction", fracChoices(pages, mins), `Slope is rate of change: $\\frac{${pages}}{${mins}}=${fracLatex(rate.n, rate.d)}$ pages per minute.`, 1.15, ["slope", "rate"], rng);
    }
    if (t === 3) {
      const slopeN = f.n;
      const slopeD = f.d;
      const changeX = slopeD * (2 + (k % 3));
      const changeY = slopeN * (changeX / slopeD);
      return makeProblem(index, topic, difficulty, source, `A line has slope $${fracLatex(slopeN, slopeD)}$. If $x$ increases by $${changeX}$, by how much does $y$ change?`, wrap(String(changeY)), String(changeY), "integer", intChoices(changeY), `Since $\\frac{\\Delta y}{\\Delta x}=${fracLatex(slopeN, slopeD)}$, $\\Delta y=${fracLatex(slopeN, slopeD)}(${changeX})=${changeY}$.`, 1.15, ["slope", "rate-of-change"], rng);
    }
    const m = choice(rng, [-4, -3, -2, 2, 3, 4]);
    const xB = x1 + 1;
    const yB = y1 + m;
    return makeProblem(index, topic, difficulty, source, `A staircase line goes through consecutive lattice points $(${x1}, ${y1})$ and $(${xB}, ${yB})$. What is the slope?`, wrap(String(m)), String(m), "integer", intChoices(m), `The rise is $${yB}-${y1}=${m}$ and the run is $1$, so the slope is $${m}$.`, 1.12, ["slope", "lattice-points"], rng);
  }
  const t = k % 5;
  if (t === 0) {
    const m = choice(rng, [-3, -2, -1, 2, 3]);
    const kVal = y1 + m * run;
    return makeProblem(index, topic, difficulty, source, `The slope of the line through $(${x1}, ${y1})$ and $(${x1 + run}, k)$ is $${m}$. What is $k$?`, wrap(String(kVal)), String(kVal), "integer", intChoices(kVal), `Use $${m}=\\frac{k-${y1}}{${run}}$, so $k-${y1}=${m * run}$ and $k=${kVal}$.`, 1.28, ["slope", "parameters"], rng);
  }
  if (t === 1) {
    const a = 2 + (k % 5);
    const b = 1 + ((k + 2) % 5);
    const f2 = reduce(-a, b);
    return makeProblem(index, topic, difficulty, source, `A line has equation $${a}x + ${b}y = ${a * x1 + b * y1}$. What is its slope?`, wrap(fracLatex(f2.n, f2.d)), fracAnswer(-a, b), "fraction", fracChoices(-a, b), `Solving for $y$ gives $${b}y=-${a}x+${a * x1 + b * y1}$, so the slope is $${fracLatex(f2.n, f2.d)}$.`, 1.3, ["slope", "standard-form"], rng);
  }
  if (t === 2) {
    const fPerp = reduce(-run, rise);
    return makeProblem(index, topic, difficulty, source, `A line through $(${x1}, ${y1})$ has slope $${fracLatex(f.n, f.d)}$. What is the slope of a perpendicular line?`, wrap(fracLatex(fPerp.n, fPerp.d)), fracAnswer(-f.d, f.n), "fraction", fracChoices(-f.d, f.n), `Perpendicular slopes are negative reciprocals, so the slope is $-${fracLatex(f.d, f.n)}=${fracLatex(fPerp.n, fPerp.d)}$.`, 1.28, ["slope", "perpendicular"], rng);
  }
  if (t === 3) {
    const totalRun = run * 3;
    const totalRise = rise * 3;
    return makeProblem(index, topic, difficulty, source, `Starting at elevation $${y1}$ feet, a trail changes elevation by $${totalRise}$ feet over a horizontal change of $${totalRun}$ feet. What is the slope of the trail?`, wrap(fracLatex(f.n, f.d)), fracAnswer(totalRise, totalRun), "fraction", fracChoices(totalRise, totalRun), `Slope is $\\frac{${totalRise}}{${totalRun}}=${fracLatex(f.n, f.d)}$.`, 1.25, ["slope", "rate"], rng);
  }
  const xB = x1 + run;
  const yB = y1 + rise;
  const xC = xB + f.d * 2;
  const yC = yB + f.n * 2;
  return makeProblem(index, topic, difficulty, source, `Points $A(${x1}, ${y1})$, $B(${xB}, ${yB})$, and $C(${xC}, k)$ lie on the same line. What is $k$?`, wrap(String(yC)), String(yC), "integer", intChoices(yC), `The slope from $A$ to $B$ is $${fracLatex(f.n, f.d)}$. Moving $${2 * f.d}$ right from $B$ changes $y$ by $${2 * f.n}$, so $k=${yC}$.`, 1.3, ["slope", "collinear", "parameters"], rng);
}

function equationDistractors(m: number, b: number): string[] {
  return [
    wrap(equationLatex(-m, b)),
    wrap(equationLatex(m, -b)),
    wrap(equationLatex(m, b + 1)),
    wrap(equationLatex(m + 1, b)),
    wrap(equationLatex(-m, -b)),
  ];
}

function genFindEquation(difficulty: Difficulty, index: number, rng: () => number): Problem {
  const topic = "ch8.find_equation";
  const source = "8.4";
  const k = index - 1;
  const m = choice(rng, [-4, -3, -2, -1, 1, 2, 3, 4]);
  const b = -8 + (k % 17);
  const x = -5 + ((k * 3) % 11);
  const y = m * x + b;
  if (difficulty === "easy") {
    const t = k % 3;
    if (t === 0) {
      return makeProblem(index, topic, difficulty, source, `Which equation has slope $${m}$ and $y$-intercept $${b}$?`, wrap(equationLatex(m, b)), equationAnswer(m, b), "string", equationDistractors(m, b), `Slope-intercept form is $y=mx+b$, so the equation is $${equationLatex(m, b)}$.`, 1.05, ["linear-equations", "slope-intercept"], rng);
    }
    if (t === 1) {
      const b0 = y - m * x;
      return makeProblem(index, topic, difficulty, source, `A line has slope $${m}$ and passes through $(${x}, ${y})$. What is its equation?`, wrap(equationLatex(m, b0)), equationAnswer(m, b0), "string", equationDistractors(m, b0), `Use $y=mx+b$: $${y}=${m}(${x})+b$, so $b=${b0}$ and the line is $${equationLatex(m, b0)}$.`, 1.1, ["linear-equations", "point-slope"], rng);
    }
    return makeProblem(index, topic, difficulty, source, `Which equation represents the line through $(0, ${b})$ with slope $${m}$?`, wrap(equationLatex(m, b)), equationAnswer(m, b), "string", equationDistractors(m, b), `The point $(0, ${b})$ gives the $y$-intercept, so $b=${b}$ and the equation is $${equationLatex(m, b)}$.`, 1.05, ["linear-equations", "slope-intercept"], rng);
  }
  if (difficulty === "medium") {
    const t = k % 4;
    if (t === 0) {
      const x2 = x + 2;
      const y2 = y + 2 * m;
      return makeProblem(index, topic, difficulty, source, `Find the equation of the line through $(${x}, ${y})$ and $(${x2}, ${y2})$.`, wrap(equationLatex(m, b)), equationAnswer(m, b), "string", equationDistractors(m, b), `The slope is $\\frac{${y2}-${y}}{${x2}-${x}}=${m}$. Then $${y}=${m}(${x})+b$, so $b=${b}$ and $${equationLatex(m, b)}$.`, 1.18, ["linear-equations", "two-points"], rng);
    }
    if (t === 1) {
      const px = -b / m;
      const cleanX = Math.trunc(px);
      const cleanB = -m * cleanX;
      return makeProblem(index, topic, difficulty, source, `Find the equation of the line with $x$-intercept $(${cleanX}, 0)$ and $y$-intercept $(0, ${cleanB})$.`, wrap(equationLatex(m, cleanB)), equationAnswer(m, cleanB), "string", equationDistractors(m, cleanB), `The slope is $\\frac{${cleanB}-0}{0-${cleanX}}=${m}$ and the $y$-intercept is $${cleanB}$, so $${equationLatex(m, cleanB)}$.`, 1.18, ["linear-equations", "intercepts"], rng);
    }
    if (t === 2) {
      return makeProblem(index, topic, difficulty, source, `A line parallel to $${equationLatex(m, b + 3)}$ passes through $(${x}, ${y})$. What is its equation?`, wrap(equationLatex(m, b)), equationAnswer(m, b), "string", equationDistractors(m, b), `Parallel lines have equal slopes. Use slope $${m}$ and point $(${x}, ${y})$: $${y}=${m}(${x})+b$, so $b=${b}$.`, 1.2, ["linear-equations", "parallel"], rng);
    }
    const m2 = -m;
    const y2 = m2 * x + b;
    return makeProblem(index, topic, difficulty, source, `Find the equation of the line through $(${x}, ${y2})$ with slope $${m2}$.`, wrap(equationLatex(m2, b)), equationAnswer(m2, b), "string", equationDistractors(m2, b), `Substitute into $y=mx+b$: $${y2}=${m2}(${x})+b$, so $b=${b}$ and the equation is $${equationLatex(m2, b)}$.`, 1.16, ["linear-equations", "point-slope"], rng);
  }
  const t = k % 5;
  if (t === 0) {
    const x2 = x + 3;
    const y2 = y + 3 * m;
    return makeProblem(index, topic, difficulty, source, `Find the equation of the line through $(${x}, ${y})$ and $(${x2}, ${y2})$.`, wrap(equationLatex(m, b)), equationAnswer(m, b), "string", equationDistractors(m, b), `The slope is $${m}$. Substituting $(${x}, ${y})$ in $y=mx+b$ gives $b=${b}$, so $${equationLatex(m, b)}$.`, 1.3, ["linear-equations", "two-points"], rng);
  }
  if (t === 1) {
    const baseM = choice(rng, [-3, -2, -1, 1, 2, 3]);
    const perpM = -1 / baseM;
    if (!Number.isInteger(perpM)) {
      const mInt = baseM === 2 ? -1 : 1;
      const bInt = y - mInt * x;
      return makeProblem(index, topic, difficulty, source, `A line perpendicular to $y=${-1 / mInt}x+1$ passes through $(${x}, ${y})$. What is its equation?`, wrap(equationLatex(mInt, bInt)), equationAnswer(mInt, bInt), "string", equationDistractors(mInt, bInt), `A perpendicular slope is the negative reciprocal, so the slope is $${mInt}$. Substitution gives $b=${bInt}$.`, 1.3, ["linear-equations", "perpendicular"], rng);
    }
    const bPerp = y - perpM * x;
    return makeProblem(index, topic, difficulty, source, `A line perpendicular to $${equationLatex(baseM, b)}$ passes through $(${x}, ${y})$. What is its equation?`, wrap(equationLatex(perpM, bPerp)), equationAnswer(perpM, bPerp), "string", equationDistractors(perpM, bPerp), `The negative reciprocal of $${baseM}$ is $${perpM}$. Using $(${x}, ${y})$ gives $b=${bPerp}$.`, 1.3, ["linear-equations", "perpendicular"], rng);
  }
  if (t === 2) {
    const a = choice(rng, [2, 3, 4, 5]);
    const bStd = choice(rng, [2, 3, 4, 5]);
    const c = a * x + bStd * y;
    const conv = equationFromStandard(a, bStd, c);
    const line = lineLatexFromSlopeIntercept(conv.mNum, conv.mDen, conv.bNum, conv.bDen);
    return makeProblem(index, topic, difficulty, source, `Which slope-intercept equation is equivalent to $${a}x + ${bStd}y = ${c}$?`, wrap(line), line.replace(/\s+/g, ""), "string", [wrap(lineLatexFromSlopeIntercept(a, bStd, c, bStd)), wrap(lineLatexFromSlopeIntercept(-a, bStd, -c, bStd)), wrap(lineLatexFromSlopeIntercept(-a, bStd, c + bStd, bStd)), wrap(lineLatexFromSlopeIntercept(a, -bStd, c, bStd)), wrap(lineLatexFromSlopeIntercept(-a, bStd, c + 2 * bStd, bStd)), wrap(lineLatexFromSlopeIntercept(bStd, a, c, bStd))], `Solve for $y$: $${bStd}y=-${a}x+${c}$, so $${line}$.`, 1.28, ["linear-equations", "standard-form", "slope-intercept"], rng);
  }
  if (t === 3) {
    const x2 = x + 4;
    const y2 = y;
    return makeProblem(index, topic, difficulty, source, `Find the equation of the horizontal line through $(${x}, ${y})$ and $(${x2}, ${y2})$.`, wrap(`y = ${y}`), `y=${y}`, "string", [wrap(`x = ${x}`), wrap(equationLatex(1, y)), wrap(equationLatex(-1, y)), wrap(`y = ${x}`)], `A horizontal line has constant $y$-value, so its equation is $y=${y}$.`, 1.25, ["linear-equations", "horizontal-line"], rng);
  }
  const xConst = x;
  return makeProblem(index, topic, difficulty, source, `Find the equation of the vertical line through $(${xConst}, ${y})$ and $(${xConst}, ${y + 5})$.`, wrap(`x = ${xConst}`), `x=${xConst}`, "string", [wrap(`y = ${y}`), wrap(`x = ${y}`), wrap(equationLatex(0, xConst)), wrap(equationLatex(1, xConst))], `A vertical line has constant $x$-value, so its equation is $x=${xConst}$.`, 1.25, ["linear-equations", "vertical-line"], rng);
}

function genSlopeIntercepts(difficulty: Difficulty, index: number, rng: () => number): Problem {
  const topic = "ch8.slope_intercepts";
  const source = "8.5";
  const k = index - 1;
  const m = choice(rng, [-4, -3, -2, -1, 1, 2, 3, 4]);
  const b = -9 + (k % 19);
  if (difficulty === "easy") {
    const t = k % 4;
    if (t === 0) {
      return makeProblem(index, topic, difficulty, source, `What is the slope of $${equationLatex(m, b)}$?`, wrap(String(m)), String(m), "integer", intChoices(m), `In $y=mx+b$, the slope is the coefficient of $x$, which is $${m}$.`, 1.0, ["slope", "slope-intercept"], rng);
    }
    if (t === 1) {
      return makeProblem(index, topic, difficulty, source, `What is the $y$-intercept point of $${equationLatex(m, b)}$?`, pointLatex(0, b), pair(0, b), "ordered_pair", pairChoices(0, b), `The $y$-intercept occurs at $x=0$, giving $(0, ${b})$.`, 1.0, ["intercepts", "slope-intercept"], rng);
    }
    if (t === 2) {
      const xInt = 2 + (k % 7);
      const cleanB = -m * xInt;
      return makeProblem(index, topic, difficulty, source, `What is the $x$-intercept point of $${equationLatex(m, cleanB)}$?`, pointLatex(xInt, 0), pair(xInt, 0), "ordered_pair", pairChoices(xInt, 0), `Set $y=0$: $0=${m}x${signed(cleanB)}$, so $x=${xInt}$.`, 1.05, ["intercepts", "x-intercept"], rng);
    }
    return makeProblem(index, topic, difficulty, source, `Which statement describes $${equationLatex(m, b)}$?`, `slope ${m}, y-intercept ${b}`, `slope${m},y-intercept${b}`, "string", [`slope ${b}, y-intercept ${m}`, `slope ${-m}, y-intercept ${b}`, `slope ${m}, y-intercept ${-b}`, `slope ${m + 1}, y-intercept ${b}`], `In $y=mx+b$, $m=${m}$ and $b=${b}$.`, 1.05, ["slope", "intercepts"], rng);
  }
  if (difficulty === "medium") {
    const t = k % 5;
    const a = 2 + (Math.floor(k / 5) % 5);
    const bb = 2 + ((Math.floor(k / 25) + k) % 5);
    const xInt = 2 + (k % 11);
    const yInt = 2 + ((2 * k + 3) % 10);
    const c = a * xInt;
    if (t === 0) {
      const f = reduce(-a, bb);
      return makeProblem(index, topic, difficulty, source, `What is the slope of $${a}x + ${bb}y = ${c}$?`, wrap(fracLatex(f.n, f.d)), fracAnswer(-a, bb), "fraction", fracChoices(-a, bb), `Solve for $y$: $${bb}y=-${a}x+${c}$, so the slope is $${fracLatex(f.n, f.d)}$.`, 1.16, ["slope", "standard-form"], rng);
    }
    if (t === 1) {
      return makeProblem(index, topic, difficulty, source, `What is the $x$-intercept point of $${a}x + ${bb}y = ${c}$?`, pointLatex(xInt, 0), pair(xInt, 0), "ordered_pair", pairChoices(xInt, 0), `Set $y=0$: $${a}x=${c}$, so $x=${xInt}$.`, 1.15, ["intercepts", "standard-form"], rng);
    }
    if (t === 2) {
      const c2 = bb * yInt;
      return makeProblem(index, topic, difficulty, source, `What is the $y$-intercept point of $${a}x + ${bb}y = ${c2}$?`, pointLatex(0, yInt), pair(0, yInt), "ordered_pair", pairChoices(0, yInt), `Set $x=0$: $${bb}y=${c2}$, so $y=${yInt}$.`, 1.15, ["intercepts", "standard-form"], rng);
    }
    if (t === 3) {
      const conv = equationFromStandard(a, bb, c);
      const line = lineLatexFromSlopeIntercept(conv.mNum, conv.mDen, conv.bNum, conv.bDen);
      return makeProblem(index, topic, difficulty, source, `Write $${a}x + ${bb}y = ${c}$ in slope-intercept form.`, wrap(line), line.replace(/\s+/g, ""), "string", [wrap(lineLatexFromSlopeIntercept(a, bb, c, bb)), wrap(lineLatexFromSlopeIntercept(-a, bb, -c, bb)), wrap(lineLatexFromSlopeIntercept(-a, bb, c + bb, bb)), wrap(lineLatexFromSlopeIntercept(a, -bb, c, bb)), wrap(lineLatexFromSlopeIntercept(-a, bb, c + 2 * bb, bb)), wrap(lineLatexFromSlopeIntercept(bb, a, c, bb))], `Move $${a}x$ to the other side and divide by $${bb}$: $${line}$.`, 1.18, ["slope-intercept", "standard-form"], rng);
    }
    const f = reduce(yInt, xInt);
    return makeProblem(index, topic, difficulty, source, `A line has intercepts $(${xInt}, 0)$ and $(0, ${yInt})$. What is its slope?`, wrap(fracLatex(-f.n, f.d)), fracAnswer(-yInt, xInt), "fraction", fracChoices(-yInt, xInt), `The slope is $\\frac{${yInt}-0}{0-${xInt}}=${fracLatex(-f.n, f.d)}$.`, 1.16, ["slope", "intercepts"], rng);
  }
  const t = k % 5;
  const a = 2 + (Math.floor(k / 5) % 6);
  const bb = 2 + ((Math.floor(k / 25) + k) % 6);
  const xInt = 2 + (k % 11);
  const yInt = 2 + ((2 * k + 4) % 10);
  if (t === 0) {
    const c = a * xInt;
    const yI = reduce(c, bb);
    const sum = reduce(xInt * yI.d + yI.n, yI.d);
    return makeProblem(index, topic, difficulty, source, `For $${a}x + ${bb}y = ${c}$, what is the sum of the $x$-intercept and the $y$-intercept?`, wrap(fracLatex(sum.n, sum.d)), fracAnswer(sum.n, sum.d), "fraction", fracChoices(sum.n, sum.d), `The intercepts are $${xInt}$ and $${fracLatex(yI.n, yI.d)}$, whose sum is $${fracLatex(sum.n, sum.d)}$.`, 1.28, ["intercepts", "standard-form"], rng);
  }
  if (t === 1) {
    const c = a * xInt;
    const f = reduce(-a, bb);
    return makeProblem(index, topic, difficulty, source, `For $${a}x + ${bb}y = ${c}$, what is the product of the slope and the $x$-intercept?`, wrap(fracLatex(f.n * xInt, f.d)), fracAnswer(f.n * xInt, f.d), "fraction", fracChoices(f.n * xInt, f.d), `The slope is $${fracLatex(f.n, f.d)}$ and the $x$-intercept is $${xInt}$, so the product is $${fracLatex(f.n * xInt, f.d)}$.`, 1.3, ["slope", "intercepts"], rng);
  }
  if (t === 2) {
    const kVal = a * xInt;
    return makeProblem(index, topic, difficulty, source, `The line $${a}x + ${bb}y = k$ has $x$-intercept $(${xInt}, 0)$. What is $k$?`, wrap(String(kVal)), String(kVal), "integer", intChoices(kVal), `At the $x$-intercept, $y=0$. Thus $k=${a}(${xInt})=${kVal}$.`, 1.25, ["intercepts", "parameters"], rng);
  }
  if (t === 3) {
    const kVal = bb * yInt;
    return makeProblem(index, topic, difficulty, source, `The line $${a}x + ${bb}y = k$ has $y$-intercept $(0, ${yInt})$. What is $k$?`, wrap(String(kVal)), String(kVal), "integer", intChoices(kVal), `At the $y$-intercept, $x=0$. Thus $k=${bb}(${yInt})=${kVal}$.`, 1.25, ["intercepts", "parameters"], rng);
  }
  const slope = reduce(-yInt, xInt);
  return makeProblem(index, topic, difficulty, source, `A line has intercepts $(${xInt},0)$ and $(0,${yInt})$. What is the slope-intercept form of its equation?`, wrap(lineLatexFromSlopeIntercept(slope.n, slope.d, yInt, 1)), lineLatexFromSlopeIntercept(slope.n, slope.d, yInt, 1).replace(/\s+/g, ""), "string", [wrap(lineLatexFromSlopeIntercept(-slope.n, slope.d, yInt, 1)), wrap(lineLatexFromSlopeIntercept(slope.n, slope.d, -yInt, 1)), wrap(lineLatexFromSlopeIntercept(slope.n, slope.d, yInt + 1, 1)), wrap(lineLatexFromSlopeIntercept(slope.d, slope.n, yInt, 1))], `The slope is $\\frac{${yInt}-0}{0-${xInt}}=${fracLatex(slope.n, slope.d)}$ and the $y$-intercept is $${yInt}$.`, 1.3, ["slope-intercept", "intercepts"], rng);
}

function relation(m1: number, b1: number, m2: number, b2: number): string {
  if (m1 === m2 && b1 === b2) return "same line";
  if (m1 === m2) return "parallel";
  if (m1 * m2 === -1) return "perpendicular";
  return "neither";
}

function relationChoices(): string[] {
  return ["parallel", "perpendicular", "same line", "neither"];
}

function genComparingLines(difficulty: Difficulty, index: number, rng: () => number): Problem {
  const topic = "ch8.comparing_lines";
  const source = "8.6";
  const k = index - 1;
  const m1 = choice(rng, [-4, -3, -2, -1, 1, 2, 3, 4]);
  const b1 = -8 + (k % 17);
  if (difficulty === "easy") {
    const t = k % 4;
    let m2 = m1;
    let b2 = b1 + 1;
    if (t === 1) {
      m2 = -m1;
      b2 = b1 + 2;
    } else if (t === 2) {
      m2 = m1;
      b2 = b1;
    } else if (t === 3) {
      m2 = m1 + (m1 > 0 ? 1 : -1);
      b2 = b1 + 3;
    }
    const ans = relation(m1, b1, m2, b2);
    return makeProblem(index, topic, difficulty, source, `Compare the lines $${equationLatex(m1, b1)}$ and $${equationLatex(m2, b2)}$.`, ans, ans, "string", relationChoices(), `Their slopes are $${m1}$ and $${m2}$. Comparing slopes and intercepts shows the lines are ${ans}.`, 1.05, ["comparing-lines", "slope"], rng);
  }
  if (difficulty === "medium") {
    const t = k % 5;
    if (t === 0) {
      const b2 = b1 + 5;
      return makeProblem(index, topic, difficulty, source, `Line $\\ell$ is $${equationLatex(m1, b1)}$ and line $n$ is $${equationLatex(m1, b2)}$. How are they related?`, "parallel", "parallel", "string", relationChoices(), `The slopes are equal and the intercepts differ, so the lines are parallel.`, 1.16, ["comparing-lines", "parallel"], rng);
    }
    if (t === 1) {
      const perp = choice(rng, [-1, 1]);
      const mA = perp;
      const mB = -perp;
      return makeProblem(index, topic, difficulty, source, `Line $\\ell$ is $${equationLatex(mA, b1)}$ and line $n$ is $${equationLatex(mB, b1 + 2)}$. How are they related?`, "perpendicular", "perpendicular", "string", relationChoices(), `The slopes multiply to $${mA * mB}$, so the lines are perpendicular.`, 1.16, ["comparing-lines", "perpendicular"], rng);
    }
    if (t === 2) {
      const a = 2 + Math.floor(k / 5);
      const bb = 2 + ((Math.floor(k / 5) + k) % 5);
      const px = 2 + (k % 5);
      const py = 3 + ((2 * k) % 5);
      const c1 = a * px + bb * py;
      const c2 = c1 + bb;
      return makeProblem(index, topic, difficulty, source, `Compare $${a}x + ${bb}y = ${c1}$ and $${a}x + ${bb}y = ${c2}$.`, "parallel", "parallel", "string", relationChoices(), `Both equations have slope $${fracLatex(-a, bb)}$, but different intercepts, so they are parallel.`, 1.18, ["comparing-lines", "standard-form"], rng);
    }
    if (t === 3) {
      const x = -3 + (k % 7);
      const y = m1 * x + b1;
      const m2 = m1 + 2;
      const b2 = y - m2 * x;
      return makeProblem(index, topic, difficulty, source, `What is the intersection point of $${equationLatex(m1, b1)}$ and $${equationLatex(m2, b2)}$?`, pointLatex(x, y), pair(x, y), "ordered_pair", pairChoices(x, y), `Both lines give $y=${y}$ when $x=${x}$, so they meet at $(${x}, ${y})$.`, 1.2, ["comparing-lines", "intersection"], rng);
    }
    return makeProblem(index, topic, difficulty, source, `Which relation describes $${equationLatex(m1, b1)}$ and $${equationLatex(m1, b1)}$?`, "same line", "same line", "string", relationChoices(), `The equations have the same slope and the same intercept, so they are the same line.`, 1.14, ["comparing-lines", "same-line"], rng);
  }
  const t = k % 5;
  if (t === 0) {
    const kVal = m1;
    return makeProblem(index, topic, difficulty, source, `For what value of $k$ are $${equationLatex(m1, b1)}$ and $y = kx ${signed(b1 + 4)}$ parallel?`, wrap(String(kVal)), String(kVal), "integer", intChoices(kVal), `Parallel lines have equal slopes, so $k=${m1}$.`, 1.28, ["comparing-lines", "parameters", "parallel"], rng);
  }
  if (t === 1) {
    const base = choice(rng, [-1, 1]);
    const kVal = -base;
    return makeProblem(index, topic, difficulty, source, `For what value of $k$ are $${equationLatex(base, b1)}$ and $y = kx ${signed(b1 + 3)}$ perpendicular?`, wrap(String(kVal)), String(kVal), "integer", intChoices(kVal), `Perpendicular slopes multiply to $-1$, so $${base}k=-1$ and $k=${kVal}$.`, 1.28, ["comparing-lines", "parameters", "perpendicular"], rng);
  }
  if (t === 2) {
    const a = choice(rng, [2, 3, 4, 5, 6]);
    const bb = choice(rng, [2, 3, 4, 5, 6]);
    const c = a * 2 + bb * 3;
    const kVal = 2 * a;
    return makeProblem(index, topic, difficulty, source, `For what value of $k$ are $${a}x + ${bb}y = ${c}$ and $kx + ${2 * bb}y = ${c + 5}$ parallel?`, wrap(String(kVal)), String(kVal), "integer", intChoices(kVal), `Parallel standard-form lines have proportional $x$ and $y$ coefficients. Since $${2 * bb}$ is twice $${bb}$, $k$ must be $2(${a})=${kVal}$.`, 1.3, ["comparing-lines", "standard-form", "parallel"], rng);
  }
  if (t === 3) {
    const x = -4 + (k % 9);
    const y = -5 + ((k * 2) % 11);
    const mA = choice(rng, [-3, -2, -1, 1, 2, 3]);
    const mB = mA + choice(rng, [-2, -1, 1, 2]);
    const bA = y - mA * x;
    const bB = y - mB * x;
    return makeProblem(index, topic, difficulty, source, `Find the intersection of $${equationLatex(mA, bA)}$ and $${equationLatex(mB, bB)}$.`, pointLatex(x, y), pair(x, y), "ordered_pair", pairChoices(x, y), `Substituting $x=${x}$ gives $y=${y}$ in both equations, so the intersection is $(${x}, ${y})$.`, 1.3, ["comparing-lines", "intersection"], rng);
  }
  const kVal = b1;
  return makeProblem(index, topic, difficulty, source, `For what value of $k$ do $${equationLatex(m1, b1)}$ and $${equationLatex(m1, 0).replace("0", "k")}$ represent the same line?`, wrap(String(kVal)), String(kVal), "integer", intChoices(kVal), `Same lines in slope-intercept form must have the same slope and intercept, so $k=${b1}$.`, 1.28, ["comparing-lines", "parameters", "same-line"], rng);
}

const generators: Record<string, (difficulty: Difficulty, index: number, rng: () => number) => Problem> = {
  "ch8.number_line_plane": genNumberLinePlane,
  "ch8.intro_graphing_linear": genIntroGraphing,
  "ch8.slope_in_problems": genSlopeProblems,
  "ch8.find_equation": genFindEquation,
  "ch8.slope_intercepts": genSlopeIntercepts,
  "ch8.comparing_lines": genComparingLines,
};

function writeFiles(): void {
  const outDir = path.join(process.cwd(), "content", "problems", GROUP_ID);
  fs.mkdirSync(outDir, { recursive: true });
  for (const [topic, gen] of Object.entries(generators)) {
    for (const difficulty of DIFFICULTIES) {
      const rng = createRng(`${topic}.${difficulty}`);
      const problems: Problem[] = [];
      const checks = new Map<string, string>();
      for (let i = 1; i <= COUNT; i++) {
        const problem = gen(difficulty, i, rng);
        if (problem.topic_id !== topic || problem.difficulty !== difficulty || problem.group_id !== GROUP_ID) {
          throw new Error(`bad metadata for ${topic}.${difficulty}.${i}`);
        }
        const existingId = checks.get(problem.checksum);
        if (existingId) throw new Error(`duplicate generated checksum ${problem.id} matches ${existingId}`);
        checks.set(problem.checksum, problem.id);
        problems.push(problem);
      }
      const file = path.join(outDir, `${topic}.${difficulty}.json`);
      fs.writeFileSync(file, JSON.stringify(problems, null, 2) + "\n");
    }
  }
}

writeFiles();
console.log("Chapter 8 graphing lines generation complete.");
