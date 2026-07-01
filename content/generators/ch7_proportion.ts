import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

type Difficulty = "easy" | "medium" | "hard";
type AnswerType = "integer" | "fraction" | "decimal" | "expression" | "ordered_pair" | "set" | "interval" | "boolean" | "string";

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

const GROUP = "ch7_proportion";
const DIFFICULTIES = ["easy", "medium", "hard"] as const;

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

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
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
  return sfc32(...cyrb128(seed));
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function shuffle<T>(rng: () => number, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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

function reduceFraction(n: number, d: number): { n: number; d: number } {
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

function fracLatex(n: number, d: number): string {
  const f = reduceFraction(n, d);
  return `\\frac{${f.n}}{${f.d}}`;
}

function checksum(problem: Partial<Problem>): string {
  const payload =
    (problem.topic_id ?? "") +
    (problem.difficulty ?? "") +
    (problem.prompt_latex ?? "") +
    (problem.correct_answer ?? "");
  return "sha256-" + crypto.createHash("sha256").update(payload).digest("hex");
}

function intDistractors(answer: number, extras: number[] = []): string[] {
  if (!Number.isInteger(answer)) {
    throw new Error(`Integer distractors require an integer answer, got ${answer}`);
  }
  const set = new Set<number>();
  const add = (n: number) => {
    if (Number.isInteger(n) && n !== answer) set.add(n);
  };
  extras.forEach(add);
  add(answer + 1);
  add(answer - 1);
  add(answer + 2);
  add(answer - 2);
  add(answer * 2);
  if (answer % 2 === 0) add(answer / 2);
  if (answer !== 0) add(-answer);
  let step = 3;
  while (set.size < 3) {
    add(answer + step);
    add(answer - step);
    step++;
  }
  return Array.from(set).slice(0, 3).map((n) => `$${n}$`);
}

function fractionDistractors(n: number, d: number): string[] {
  const correct = reduceFraction(n, d);
  const set = new Map<string, { n: number; d: number }>();
  const add = (a: number, b: number) => {
    if (b === 0) return;
    const f = reduceFraction(a, b);
    if (f.n === correct.n && f.d === correct.d) return;
    set.set(`${f.n}/${f.d}`, f);
  };
  add(n + 1, d);
  add(n - 1, d);
  add(n, d + 1);
  add(n, d - 1);
  add(d, n);
  add(-n, d);
  let k = 2;
  while (set.size < 3) {
    add(n + k, d + 1);
    k++;
  }
  return Array.from(set.values()).slice(0, 3).map((f) => `$\\frac{${f.n}}{${f.d}}$`);
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
  const mixed = shuffle(rng, [
    { latex: correctLatex, correct: true },
    ...distractors.map((latex) => ({ latex, correct: false })),
  ]);
  const ids = ["a", "b", "c", "d"];
  const choices = mixed.map((choice, i) => ({ id: ids[i], latex: choice.latex }));
  const correctChoice = ids[mixed.findIndex((choice) => choice.correct)];
  const problem: Problem = {
    id: `${topic}.${difficulty}.${String(index).padStart(4, "0")}`,
    topic_id: topic,
    group_id: GROUP,
    difficulty,
    prompt_latex: prompt,
    answer_format: "mc",
    choices,
    correct_choice: correctChoice,
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
  problem.checksum = checksum(problem);
  return problem;
}

function addIntProblem(
  out: Problem[],
  topic: string,
  difficulty: Difficulty,
  source: string,
  prompt: string,
  answer: number,
  extras: number[],
  solution: string,
  complexity: number,
  tags: string[],
  rng: () => number
): void {
  if (!Number.isInteger(answer)) {
    throw new Error(`${topic}.${difficulty} produced non-integer answer ${answer} for prompt: ${prompt}`);
  }
  out.push(
    makeProblem(
      out.length + 1,
      topic,
      difficulty,
      source,
      prompt,
      `$${answer}$`,
      `${answer}`,
      "integer",
      intDistractors(answer, extras),
      solution,
      complexity,
      tags,
      rng
    )
  );
}

function addFractionProblem(
  out: Problem[],
  topic: string,
  difficulty: Difficulty,
  source: string,
  prompt: string,
  n: number,
  d: number,
  solution: string,
  complexity: number,
  tags: string[],
  rng: () => number
): void {
  const f = reduceFraction(n, d);
  out.push(
    makeProblem(
      out.length + 1,
      topic,
      difficulty,
      source,
      prompt,
      `$\\frac{${f.n}}{${f.d}}$`,
      `${f.n}/${f.d}`,
      "fraction",
      fractionDistractors(f.n, f.d),
      solution,
      complexity,
      tags,
      rng
    )
  );
}

function direct(difficulty: Difficulty, rng: () => number): Problem[] {
  const topic = "ch7.direct";
  const source = "7.1";
  const out: Problem[] = [];

  if (difficulty === "easy") {
    for (let i = 0; i < 10; i++) {
      const k = i + 2;
      const x1 = i + 3;
      const x2 = i + 6;
      const y1 = k * x1;
      const ans = k * x2;
      addIntProblem(out, topic, difficulty, source, `The variable $y$ is directly proportional to $x$. If $y=${y1}$ when $x=${x1}$, what is $y$ when $x=${x2}$?`, ans, [y1, ans + k, x2 * y1], `The constant of proportionality is $${y1}/${x1}=${k}$. Thus $y=${k}\\cdot ${x2}=${ans}$.`, 0.95, ["direct", "proportion"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const price = i + 3;
      const pounds = i + 4;
      const ans = price * pounds;
      addIntProblem(out, topic, difficulty, source, `Apples cost $${price}$ dollars per pound. If cost is directly proportional to weight, what is the cost in dollars of $${pounds}$ pounds?`, ans, [price + pounds, ans - price, pounds], `Cost equals rate times weight, so the cost is $${price}\\cdot ${pounds}=${ans}$.`, 0.9, ["direct", "unit-rate"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const k = i + 4;
      const x = i + 5;
      const ans = k * x;
      addIntProblem(out, topic, difficulty, source, `In a direct proportion table, $y=${k}x$. What value of $y$ goes with $x=${x}$?`, ans, [ans + x, ans - k, k + x], `Substitute $x=${x}$ into $y=${k}x$: $y=${k}\\cdot ${x}=${ans}$.`, 0.85, ["direct", "table"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const scale = i + 5;
      const cm = i + 2;
      const ans = scale * cm;
      addIntProblem(out, topic, difficulty, source, `On a map, each centimeter represents $${scale}$ kilometers. How many kilometers are represented by $${cm}$ centimeters?`, ans, [scale + cm, ans + scale, ans - cm], `Distance is directly proportional to map length, so the distance is $${scale}\\cdot ${cm}=${ans}$ kilometers.`, 0.9, ["direct", "scale"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const k = i + 3;
      const ans = i + 7;
      const y = k * ans;
      addIntProblem(out, topic, difficulty, source, `The equation $y=${k}x$ gives a direct proportion. If $y=${y}$, what is $x$?`, ans, [y, y - k, ans + k], `Solve $${y}=${k}x$, so $x=${y}/${k}=${ans}$.`, 0.95, ["direct", "equation"], rng);
    }
  }

  if (difficulty === "medium") {
    for (let i = 0; i < 10; i++) {
      const k = i + 4;
      const x1 = i + 5;
      const x2 = i + 8;
      const y1 = k * x1;
      const ans = k * x2;
      addIntProblem(out, topic, difficulty, source, `A quantity $y$ varies directly with $x$. When $x=${x1}$, $y=${y1}$. If $x$ is changed to $${x2}$, what is the new value of $y$?`, ans, [y1 + x2, ans - k, y1], `Since $y/x$ is constant, $y/x=${y1}/${x1}=${k}$. The new value is $${k}\\cdot ${x2}=${ans}$.`, 1.0, ["direct", "proportion"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const cups = i + 2;
      const sugar = 2 * cups;
      const flour = i + 6;
      const ans = (sugar * flour) / cups;
      addIntProblem(out, topic, difficulty, source, `A recipe uses $${sugar}$ cups of sugar for $${cups}$ cups of flour, and sugar is directly proportional to flour. How many cups of sugar are needed for $${flour}$ cups of flour?`, ans, [sugar + flour, ans - 2, sugar], `The scale factor from $${cups}$ to $${flour}$ cups of flour is $${flour}/${cups}$. Thus sugar is $${sugar}\\cdot ${flour}/${cups}=${ans}$.`, 1.05, ["direct", "recipe"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const rate = i + 6;
      const minutes = i + 4;
      const extra = i + 3;
      const ans = rate * (minutes + extra);
      addIntProblem(out, topic, difficulty, source, `A printer produces pages directly proportional to time. It prints $${rate * minutes}$ pages in $${minutes}$ minutes. How many pages will it print in $${minutes + extra}$ minutes?`, ans, [rate * extra, ans - rate, rate + minutes + extra], `The rate is $${rate * minutes}/${minutes}=${rate}$ pages per minute. In $${minutes + extra}$ minutes it prints $${rate}\\cdot ${minutes + extra}=${ans}$ pages.`, 1.0, ["direct", "rate"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const k = i + 2;
      const x1 = i + 6;
      const y1 = k * x1;
      const ans = i + 9;
      const y2 = k * ans;
      addIntProblem(out, topic, difficulty, source, `The variables $x$ and $y$ are directly proportional. If $x=${x1}$ gives $y=${y1}$, what value of $x$ gives $y=${y2}$?`, ans, [y2, ans + k, x1 + y2], `The constant is $${y1}/${x1}=${k}$, so $${y2}=${k}x$ and $x=${ans}$.`, 1.0, ["direct", "solve"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const k = i + 3;
      const a = i + 4;
      const b = i + 7;
      const ans = k * (a + b);
      addIntProblem(out, topic, difficulty, source, `A direct proportion has $y=${k}x$. What is the value of $y$ when $x$ is the sum of $${a}$ and $${b}$?`, ans, [k * a, k * b, ans + k], `Here $x=${a}+${b}=${a + b}$, so $y=${k}\\cdot ${a + b}=${ans}$.`, 1.0, ["direct", "expression"], rng);
    }
  }

  if (difficulty === "hard") {
    for (let i = 0; i < 10; i++) {
      const k = i + 3;
      const a = i + 4;
      const b = i + 7;
      const c = i + 10;
      const sum = k * (a + b);
      const ans = k * c;
      addIntProblem(out, topic, difficulty, source, `The variable $y$ varies directly with $x$. The sum of the values of $y$ at $x=${a}$ and $x=${b}$ is $${sum}$. What is $y$ when $x=${c}$?`, ans, [sum, ans - k, k * (a + b + c)], `If $y=kx$, then $${sum}=k(${a}+${b})$, so $k=${k}$. Therefore $y=${k}\\cdot ${c}=${ans}$.`, 1.25, ["direct", "multi-step"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const k = i + 4;
      const start = i + 5;
      const change = i + 3;
      const target = start + 2 * change;
      const increase = k * change;
      const ans = k * target;
      addIntProblem(out, topic, difficulty, source, `The variable $y$ is directly proportional to $x$. Increasing $x$ by $${change}$ increases $y$ by $${increase}$. If $x=${target}$, what is $y$?`, ans, [increase * target, ans - increase, k + target], `The constant of proportionality is $${increase}/${change}=${k}$. Hence $y=${k}\\cdot ${target}=${ans}$.`, 1.3, ["direct", "change"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const k = i + 5;
      const a = i + 6;
      const gap = i + 4;
      const b = a + gap;
      const difference = k * gap;
      const c = i + 12;
      const ans = k * c;
      addIntProblem(out, topic, difficulty, source, `For a direct proportion, the values of $y$ at $x=${a}$ and $x=${b}$ differ by $${difference}$. What is the value of $y$ at $x=${c}$?`, ans, [difference, ans + difference, k * (c - gap)], `The change in $x$ is $${gap}$, so the constant is $${difference}/${gap}=${k}$. At $x=${c}$, $y=${ans}$.`, 1.3, ["direct", "difference"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const k = i + 2;
      const a = i + 4;
      const b = i + 6;
      const ans = k * (2 * a + 3 * b);
      addIntProblem(out, topic, difficulty, source, `The function $f$ is directly proportional to its input, and $f(${a})=${k * a}$. What is $f(${2 * a})+f(${3 * b})$?`, ans, [k * (a + b), ans - k, k * (2 * a + b)], `Since $f(x)=${k}x$, the sum is $${k}(${2 * a}+${3 * b})=${ans}$.`, 1.35, ["direct", "function"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const k = i + 3;
      const x = i + 7;
      const offset = i + 5;
      const y = k * x;
      const ans = k * offset;
      addIntProblem(out, topic, difficulty, source, `The quantity $y$ varies directly with $x$. When $x$ is increased from $${x}$ to $${x + offset}$, by how much does $y$ increase if $y=${y}$ when $x=${x}$?`, ans, [offset, ans + y, y - ans], `The constant is $${y}/${x}=${k}$. An increase of $${offset}$ in $x$ increases $y$ by $${k}\\cdot ${offset}=${ans}$.`, 1.25, ["direct", "increase"], rng);
    }
  }

  return out;
}

function inverse(difficulty: Difficulty, rng: () => number): Problem[] {
  const topic = "ch7.inverse";
  const source = "7.2";
  const out: Problem[] = [];

  if (difficulty === "easy") {
    for (let i = 0; i < 10; i++) {
      const k = (i + 3) * (i + 4);
      const x1 = i + 3;
      const y1 = k / x1;
      const x2 = i + 4;
      const ans = k / x2;
      addIntProblem(out, topic, difficulty, source, `$y$ is inversely proportional to $x$. If $y=${y1}$ when $x=${x1}$, what is $y$ when $x=${x2}$?`, ans, [y1, ans + x2, k], `For inverse proportion, $xy$ is constant. The constant is $${x1}\\cdot ${y1}=${k}$, so $y=${k}/${x2}=${ans}$.`, 0.95, ["inverse", "proportion"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const workers1 = i + 3;
      const days1 = i + 4;
      const workers2 = i + 6;
      const total = workers1 * days1 * workers2;
      const ans = total / workers2;
      addIntProblem(out, topic, difficulty, source, `$${workers1}$ workers can finish a job in $${days1 * workers2}$ days. How many days would $${workers2}$ workers need at the same pace?`, ans, [days1 * workers2, ans + workers2, total], `Worker-days stay constant: $${workers1}\\cdot ${days1 * workers2}=${total}$. Dividing by $${workers2}$ workers gives $${ans}$ days.`, 1.0, ["inverse", "work"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const speed1 = i + 5;
      const time1 = i + 4;
      const speed2 = i + 8;
      const distance = speed1 * time1 * speed2;
      const oldTime = distance / speed1;
      const ans = distance / speed2;
      addIntProblem(out, topic, difficulty, source, `For a fixed distance, travel time is inversely proportional to speed. If a trip takes $${oldTime}$ hours at $${speed1}$ mph, how many hours does it take at $${speed2}$ mph?`, ans, [oldTime, ans + speed2, distance], `The distance is $${speed1}\\cdot ${oldTime}=${distance}$. The new time is $${distance}/${speed2}=${ans}$ hours.`, 1.0, ["inverse", "speed"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const machines1 = i + 2;
      const minutes1 = i + 5;
      const machines2 = i + 4;
      const total = machines1 * machines2 * minutes1;
      const oldMinutes = total / machines1;
      const ans = total / machines2;
      addIntProblem(out, topic, difficulty, source, `Identical machines share a fixed task, so time is inversely proportional to the number of machines. If $${machines1}$ machines need $${oldMinutes}$ minutes, how many minutes do $${machines2}$ machines need?`, ans, [oldMinutes, ans + machines1, total], `Machine-minutes are constant: $${machines1}\\cdot ${oldMinutes}=${total}$. With $${machines2}$ machines, time is $${total}/${machines2}=${ans}$.`, 1.0, ["inverse", "machines"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const x = i + 3;
      const y = 2 * (i + 5);
      const k = x * y;
      const newX = 2 * x;
      const ans = k / newX;
      addIntProblem(out, topic, difficulty, source, `The product $xy$ stays constant. If $x=${x}$ and $y=${y}$, what is $y$ when $x=${newX}$?`, ans, [y, k, ans + x], `The constant product is $${x}\\cdot ${y}=${k}$. Thus $y=${k}/${newX}=${ans}$.`, 0.95, ["inverse", "product"], rng);
    }
  }

  if (difficulty === "medium") {
    for (let i = 0; i < 10; i++) {
      const k = (i + 5) * (i + 7);
      const x1 = i + 5;
      const y1 = k / x1;
      const ans = i + 7;
      const y2 = k / ans;
      addIntProblem(out, topic, difficulty, source, `$y$ varies inversely with $x$. If $x=${x1}$ gives $y=${y1}$, what value of $x$ gives $y=${y2}$?`, ans, [x1, y2, ans + y2], `The constant product is $${x1}\\cdot ${y1}=${k}$. Since $${y2}x=${k}$, we get $x=${ans}$.`, 1.05, ["inverse", "solve"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const area = (i + 6) * (i + 8);
      const width = i + 6;
      const length = area / width;
      const newWidth = i + 8;
      const ans = area / newWidth;
      addIntProblem(out, topic, difficulty, source, `Rectangles have fixed area $${area}$. One rectangle has width $${width}$ and length $${length}$. What is the length when the width is $${newWidth}$?`, ans, [length, ans + width, area], `For fixed area, length and width are inversely proportional. The length is $${area}/${newWidth}=${ans}$.`, 1.05, ["inverse", "area"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const workers1 = i + 4;
      const hours1 = i + 5;
      const days1 = i + 3;
      const workers2 = i + 6;
      const hours2 = i + 4;
      const total = workers1 * hours1 * days1 * workers2 * hours2;
      const oldDays = total / (workers1 * hours1);
      const ans = total / (workers2 * hours2);
      addIntProblem(out, topic, difficulty, source, `$${workers1}$ workers working $${hours1}$ hours per day finish a job in $${oldDays}$ days. How many days will $${workers2}$ workers working $${hours2}$ hours per day need?`, ans, [oldDays, ans + workers2, days1 * hours1], `Total worker-hours are constant. They are $${workers1}\\cdot ${hours1}\\cdot ${oldDays}=${total}$, so the new days are $${total}/(${workers2}\\cdot ${hours2})=${ans}$.`, 1.15, ["inverse", "work"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const x1 = i + 6;
      const y1 = 3 * (i + 5);
      const factor = 3;
      const ans = y1 / factor;
      addIntProblem(out, topic, difficulty, source, `$y$ is inversely proportional to $x$. If $y=${y1}$ at $x=${x1}$, what is $y$ when $x$ is tripled?`, ans, [y1 * factor, y1 + factor, y1 - factor], `Tripling $x$ divides $y$ by $3$, so the new value is $${y1}/3=${ans}$.`, 1.05, ["inverse", "scaling"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const pages = (i + 7) * (i + 4) * 2;
      const rate1 = i + 4;
      const time1 = pages / rate1;
      const rate2 = i + 7;
      const ans = pages / rate2;
      addIntProblem(out, topic, difficulty, source, `A fixed packet has $${pages}$ pages. Reading time is inversely proportional to pages read per minute. At $${rate1}$ pages per minute it takes $${time1}$ minutes. How long at $${rate2}$ pages per minute?`, ans, [time1, ans + rate2, pages], `The page count is fixed, so time is $${pages}/${rate2}=${ans}$ minutes.`, 1.05, ["inverse", "reading-rate"], rng);
    }
  }

  if (difficulty === "hard") {
    for (let i = 0; i < 10; i++) {
      const k = (i + 4) * 18;
      const a = 3;
      const b = 6;
      const c = 9;
      const sum = k / a + k / b;
      const ans = k / c;
      addIntProblem(out, topic, difficulty, source, `$y$ varies inversely with $x$. The sum of the values of $y$ at $x=${a}$ and $x=${b}$ is $${sum}$. What is $y$ at $x=${c}$?`, ans, [sum, ans + k / b, k], `Since $y=k/x$, $${sum}=k/${a}+k/${b}=k/2$, so $k=${k}$. Thus $y=${k}/${c}=${ans}$.`, 1.3, ["inverse", "multi-step"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const k = (i + 5) * 60;
      const a = 6;
      const b = 10;
      const diff = k / a - k / b;
      const c = 15;
      const ans = k / c;
      addIntProblem(out, topic, difficulty, source, `For an inverse proportion, increasing $x$ from $${a}$ to $${b}$ decreases $y$ by $${diff}$. What is $y$ when $x=${c}$?`, ans, [diff, ans + diff, k / b], `The decrease is $k/${a}-k/${b}=k(1/${a}-1/${b})=${diff}$, so $k=${k}$. Then $y=${k}/${c}=${ans}$.`, 1.35, ["inverse", "difference"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const distance = (i + 6) * 120;
      const r1 = 30;
      const r2 = 40;
      const diff = distance / r1 - distance / r2;
      const ans = distance / 60;
      addIntProblem(out, topic, difficulty, source, `A fixed-distance trip takes $${diff}$ hours longer at $${r1}$ mph than at $${r2}$ mph. How many hours would the trip take at $60$ mph?`, ans, [diff, distance / r2, distance], `Let the distance be $d$. Then $d/${r1}-d/${r2}=${diff}$, so $d=${distance}$. At $60$ mph the time is $${distance}/60=${ans}$ hours.`, 1.4, ["inverse", "speed"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const total = (i + 5) * 360;
      const w1 = 6;
      const h1 = 5;
      const oldDays = total / (w1 * h1);
      const w2 = 9;
      const h2 = 4;
      const ans = total / (w2 * h2);
      addIntProblem(out, topic, difficulty, source, `$${w1}$ workers working $${h1}$ hours per day complete a task in $${oldDays}$ days. If the crew changes to $${w2}$ workers working $${h2}$ hours per day, how many days are needed?`, ans, [oldDays, ans + w2, total / w2], `Total worker-hours are $${w1}\\cdot ${h1}\\cdot ${oldDays}=${total}$. The new time is $${total}/(${w2}\\cdot ${h2})=${ans}$ days.`, 1.35, ["inverse", "work"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const k = (i + 7) * 24;
      const x1 = 6;
      const x2 = 8;
      const ans = k / 12;
      const totalY = k / x1 + k / x2;
      addIntProblem(out, topic, difficulty, source, `$a$ is inversely proportional to $b$. The sum of the values of $a$ when $b=${x1}$ and $b=${x2}$ is $${totalY}$. What is $a$ when $b=12$?`, ans, [totalY, k / x2, ans + x1], `Write $a=k/b$. Then $${totalY}=k/${x1}+k/${x2}=7k/24$, so $k=${k}$. Therefore $a=${k}/12=${ans}$.`, 1.35, ["inverse", "constant"], rng);
    }
  }

  return out;
}

function joint(difficulty: Difficulty, rng: () => number): Problem[] {
  const topic = "ch7.joint";
  const source = "7.3";
  const out: Problem[] = [];

  if (difficulty === "easy") {
    for (let i = 0; i < 10; i++) {
      const k = i + 2;
      const x = i + 3;
      const y = i + 4;
      const ans = k * x * y;
      addIntProblem(out, topic, difficulty, source, `$z$ varies jointly with $x$ and $y$, and $z=${k}xy$. What is $z$ when $x=${x}$ and $y=${y}$?`, ans, [k * x, k * y, x * y], `Substitute into $z=${k}xy$: $z=${k}\\cdot ${x}\\cdot ${y}=${ans}$.`, 1.0, ["joint", "proportion"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const rate = i + 3;
      const workers = i + 2;
      const hours = i + 5;
      const ans = rate * workers * hours;
      addIntProblem(out, topic, difficulty, source, `Output is jointly proportional to workers and hours. If each worker makes $${rate}$ items per hour, how many items do $${workers}$ workers make in $${hours}$ hours?`, ans, [rate * hours, workers * hours, ans - rate], `Output is $${rate}\\cdot ${workers}\\cdot ${hours}=${ans}$ items.`, 1.0, ["joint", "work"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const cost = i + 4;
      const people = i + 3;
      const days = i + 2;
      const ans = cost * people * days;
      addIntProblem(out, topic, difficulty, source, `The total cost of tickets is jointly proportional to the number of people and days. At $${cost}$ dollars per person per day, what is the cost for $${people}$ people for $${days}$ days?`, ans, [cost * people, cost * days, people * days], `The cost is $${cost}\\cdot ${people}\\cdot ${days}=${ans}$ dollars.`, 1.0, ["joint", "cost"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const k = i + 2;
      const x = i + 4;
      const y = i + 6;
      const ans = k * x * y;
      addIntProblem(out, topic, difficulty, source, `$A$ varies jointly with $m$ and $n$. If the constant of proportionality is $${k}$, what is $A$ when $m=${x}$ and $n=${y}$?`, ans, [k + x + y, k * x, x * y], `Joint variation gives $A=${k}mn=${k}\\cdot ${x}\\cdot ${y}=${ans}$.`, 1.0, ["joint", "constant"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const k = i + 3;
      const x = i + 5;
      const y = i + 2;
      const z = k * x * y;
      addIntProblem(out, topic, difficulty, source, `$z$ varies jointly with $x$ and $y$. If $z=${z}$ when $x=${x}$ and $y=${y}$, what is the constant of proportionality?`, k, [z, x * y, k + x], `For $z=kxy$, the constant is $k=${z}/(${x}\\cdot ${y})=${k}$.`, 1.0, ["joint", "constant"], rng);
    }
  }

  if (difficulty === "medium") {
    for (let i = 0; i < 10; i++) {
      const k = i + 2;
      const x = i + 4;
      const y = i + 5;
      const z = k * x * y;
      const newY = i + 7;
      const newZ = k * (i + 6) * newY;
      const ans = newZ / (k * newY);
      addIntProblem(out, topic, difficulty, source, `$z$ varies jointly with $x$ and $y$. If $z=${z}$ when $x=${x}$ and $y=${y}$, what is $x$ when $z=${newZ}$ and $y=${newY}$?`, ans, [x, newZ / k, ans + newY], `First $k=${z}/(${x}\\cdot ${y})=${k}$. Then $${newZ}=${k}\\cdot x\\cdot ${newY}$, so $x=${ans}$.`, 1.15, ["joint", "solve"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const old = i + 4;
      const ans = old * 6;
      addIntProblem(out, topic, difficulty, source, `A quantity varies jointly with $x$ and $y$. If $x$ is doubled and $y$ is tripled, an old value of $${old}$ changes to what new value?`, ans, [old * 5, old * 3, old * 2], `Joint variation multiplies by both scale factors, so the new value is $${old}\\cdot 2\\cdot 3=${ans}$.`, 1.1, ["joint", "scaling"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const k = i + 3;
      const x = i + 6;
      const ans = i + 5;
      const z = k * x * ans;
      addIntProblem(out, topic, difficulty, source, `$z$ varies jointly with $x$ and $y$ with constant $${k}$. If $z=${z}$ and $x=${x}$, what is $y$?`, ans, [z, ans + k, x * ans], `Use $z=${k}xy$: $${z}=${k}\\cdot ${x}\\cdot y$, so $y=${ans}$.`, 1.1, ["joint", "equation"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const rate = i + 4;
      const workers = i + 3;
      const hours = 2 * (i + 4);
      const output = rate * workers * hours;
      const newHours = hours / 2;
      const ans = output / (rate * newHours);
      addIntProblem(out, topic, difficulty, source, `Output varies jointly with workers and hours. If $${workers}$ workers working $${hours}$ hours make $${output}$ items, how many workers are needed to make $${output}$ items in $${newHours}$ hours at the same rate?`, ans, [workers, ans + newHours, output / rate], `The rate per worker-hour is $${output}/(${workers}\\cdot ${hours})=${rate}$. We need $${output}/(${rate}\\cdot ${newHours})=${ans}$ workers.`, 1.2, ["joint", "work"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const k = i + 2;
      const x1 = i + 3;
      const y1 = i + 5;
      const z1 = k * x1 * y1;
      const x2 = i + 6;
      const y2 = i + 4;
      const ans = k * x2 * y2;
      addIntProblem(out, topic, difficulty, source, `$z$ varies jointly with $x$ and $y$. If $z=${z1}$ at $x=${x1}$ and $y=${y1}$, what is $z$ at $x=${x2}$ and $y=${y2}$?`, ans, [z1, k * (x2 + y2), ans - z1], `The constant is $${z1}/(${x1}\\cdot ${y1})=${k}$. Thus $z=${k}\\cdot ${x2}\\cdot ${y2}=${ans}$.`, 1.15, ["joint", "proportion"], rng);
    }
  }

  if (difficulty === "hard") {
    for (let i = 0; i < 10; i++) {
      const k = i + 2;
      const sum = k * (2 * 3 + 4 * 5);
      const ans = k * (6 + i) * (7 + i);
      addIntProblem(out, topic, difficulty, source, `$z$ varies jointly with $x$ and $y$. The sum of the values of $z$ at $(x,y)=(2,3)$ and $(4,5)$ is $${sum}$. What is $z$ at $(x,y)=(${6 + i},${7 + i})$?`, ans, [sum, ans - k, k * (13 + 2 * i)], `Since $z=kxy$, the sum is $k(2\\cdot3+4\\cdot5)=26k=${sum}$, so $k=${k}$. The requested value is $${k}\\cdot ${6 + i}\\cdot ${7 + i}=${ans}$.`, 1.35, ["joint", "multi-step"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const k = (i + 2) * 6;
      const x = i + 4;
      const y = i + 5;
      const w = 2;
      const z = (k * x * y) / w;
      const newX = i + 6;
      const newY = i + 7;
      const newW = 3;
      const ans = (k * newX * newY) / newW;
      addIntProblem(out, topic, difficulty, source, `$z$ varies jointly with $x$ and $y$ and inversely with $w$. If $z=${z}$ when $x=${x}$, $y=${y}$, and $w=${w}$, what is $z$ when $x=${newX}$, $y=${newY}$, and $w=${newW}$?`, ans, [z, ans + k, k * newX * newY], `Use $z=kxy/w$. The first data give $k=${k}$. Then $z=${k}\\cdot ${newX}\\cdot ${newY}/${newW}=${ans}$.`, 1.4, ["joint", "inverse", "combined"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const k = i + 4;
      const y = i + 3;
      const changeX = i + 2;
      const changeZ = k * y * changeX;
      const targetX = i + 8;
      const ans = k * targetX * y;
      addIntProblem(out, topic, difficulty, source, `$z$ varies jointly with $x$ and $y$. Holding $y=${y}$ fixed, increasing $x$ by $${changeX}$ increases $z$ by $${changeZ}$. What is $z$ when $x=${targetX}$ and $y=${y}$?`, ans, [changeZ, ans - changeZ, k * targetX], `With $y$ fixed, the change is $k\\cdot ${y}\\cdot ${changeX}=${changeZ}$, so $k=${k}$. Thus $z=${k}\\cdot ${targetX}\\cdot ${y}=${ans}$.`, 1.4, ["joint", "change"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const base = i + 5;
      const ans = base * 12;
      addIntProblem(out, topic, difficulty, source, `A quantity varies jointly with $x$ and $y$. Starting from value $${base}$, $x$ is multiplied by $4$ and $y$ is multiplied by $3$. What is the new value?`, ans, [base * 7, base * 4, base * 3], `Joint variation multiplies by $4\\cdot3=12$, so the new value is $${base}\\cdot 12=${ans}$.`, 1.3, ["joint", "scaling"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const k = i + 3;
      const x = i + 4;
      const y = i + 5;
      const z = k * x * y;
      const newX = x + 2;
      const newY = y + 3;
      const ans = k * newX * newY - z;
      addIntProblem(out, topic, difficulty, source, `$z$ varies jointly with $x$ and $y$. If $z=${z}$ when $x=${x}$ and $y=${y}$, by how much does $z$ increase when $x=${newX}$ and $y=${newY}$?`, ans, [z, ans + k, k * (newX + newY)], `The constant is $${z}/(${x}\\cdot ${y})=${k}$. The new value is $${k}\\cdot ${newX}\\cdot ${newY}=${z + ans}$, so the increase is $${ans}$.`, 1.4, ["joint", "increase"], rng);
    }
  }

  return out;
}

function rate(difficulty: Difficulty, rng: () => number): Problem[] {
  const topic = "ch7.rate";
  const source = "7.4";
  const out: Problem[] = [];

  if (difficulty === "easy") {
    for (let i = 0; i < 10; i++) {
      const r = i + 5;
      const t = i + 3;
      const ans = r * t;
      addIntProblem(out, topic, difficulty, source, `A cyclist rides at $${r}$ miles per hour for $${t}$ hours. How many miles does the cyclist ride?`, ans, [r + t, ans - r, ans + t], `Distance equals rate times time: $${r}\\cdot ${t}=${ans}$ miles.`, 0.95, ["rate", "distance"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const r = i + 4;
      const ans = i + 5;
      const d = r * ans;
      addIntProblem(out, topic, difficulty, source, `A car travels $${d}$ miles at $${r}$ miles per hour. How many hours does the trip take?`, ans, [d, ans + r, d - r], `Time equals distance divided by rate: $${d}/${r}=${ans}$ hours.`, 0.95, ["rate", "time"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const ratePerHour = i + 6;
      const hours = i + 2;
      const ans = ratePerHour * hours;
      addIntProblem(out, topic, difficulty, source, `A faucet fills $${ratePerHour}$ gallons per hour. How many gallons does it fill in $${hours}$ hours?`, ans, [ratePerHour + hours, ans - hours, ans + ratePerHour], `Amount equals rate times time: $${ratePerHour}\\cdot ${hours}=${ans}$ gallons.`, 0.95, ["rate", "fill"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const pages = i + 8;
      const minutes = i + 4;
      const ans = pages * minutes;
      addIntProblem(out, topic, difficulty, source, `A printer prints $${pages}$ pages each minute. How many pages does it print in $${minutes}$ minutes?`, ans, [pages + minutes, ans - pages, ans + minutes], `Pages printed are $${pages}\\cdot ${minutes}=${ans}$.`, 0.9, ["rate", "unit-rate"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const units = i + 3;
      const cost = i + 4;
      const ans = units * cost;
      addIntProblem(out, topic, difficulty, source, `A snack costs $${cost}$ dollars each. At that rate, what is the cost of $${units}$ snacks?`, ans, [units + cost, ans - cost, ans + units], `The total cost is $${cost}\\cdot ${units}=${ans}$ dollars.`, 0.9, ["rate", "unit-cost"], rng);
    }
  }

  if (difficulty === "medium") {
    for (let i = 0; i < 10; i++) {
      const r1 = i + 5;
      const r2 = i + 7;
      const t = i + 3;
      const d = (r1 + r2) * t;
      addIntProblem(out, topic, difficulty, source, `Two walkers start $${d}$ miles apart and walk toward each other at $${r1}$ mph and $${r2}$ mph. How many hours until they meet?`, t, [d / r1, d / r2, t + r1], `Their closing rate is $${r1}+${r2}=${r1 + r2}$ mph, so time is $${d}/${r1 + r2}=${t}$ hours.`, 1.15, ["rate", "relative-rate"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const slow = i + 4;
      const fast = slow + 3;
      const t = i + 5;
      const headStart = (fast - slow) * t;
      addIntProblem(out, topic, difficulty, source, `A runner moving $${fast}$ mph starts after a walker moving $${slow}$ mph. If the walker has a $${headStart}$ mile head start, how many hours will the runner take to catch up?`, t, [headStart / fast, headStart / slow, t + slow], `The catching rate is $${fast}-${slow}=3$ mph. Time is $${headStart}/3=${t}$ hours.`, 1.15, ["rate", "catch-up"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const a = 3 * (i + 2);
      const b = 6 * (i + 2);
      const total = a * b;
      const rateA = total / a;
      const rateB = total / b;
      const ans = total / (rateA + rateB);
      addIntProblem(out, topic, difficulty, source, `One pipe fills a tank in $${a}$ hours and another fills the same tank in $${b}$ hours. If both pipes work together on a tank of $${total}$ equal units, how many hours are needed?`, ans, [a + b, Math.min(a, b), ans + 1], `The rates are $${rateA}$ and $${rateB}$ units per hour, for a combined rate of $${rateA + rateB}$. Time is $${total}/${rateA + rateB}=${ans}$ hours.`, 1.2, ["rate", "work"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const r1 = 2 * (i + 5);
      const r2 = 2 * (i + 7);
      const ans = (r1 + r2) / 2;
      addIntProblem(out, topic, difficulty, source, `A train travels $2$ hours at $${r1}$ mph and $2$ hours at $${r2}$ mph. What is its average speed in mph?`, ans, [r1 + r2, r2 - r1, ans + 2], `For equal times, average speed is the average of the speeds: $(${r1}+${r2})/2=${ans}$.`, 1.1, ["rate", "average-speed"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const rate = i + 6;
      const minutes = 15;
      const batches = i + 4;
      const ans = rate * batches * minutes;
      addIntProblem(out, topic, difficulty, source, `A machine makes $${rate}$ parts per minute. How many parts can $${batches}$ identical machines make in $${minutes}$ minutes?`, ans, [rate * minutes, rate * batches, ans - rate], `The total rate is $${rate}\\cdot ${batches}$ parts per minute, so output is $${rate}\\cdot ${batches}\\cdot ${minutes}=${ans}$.`, 1.1, ["rate", "combined-rate"], rng);
    }
  }

  if (difficulty === "hard") {
    const pairs = [
      [20, 30],
      [24, 40],
      [30, 60],
      [36, 72],
      [40, 60],
      [45, 90],
      [48, 80],
      [50, 75],
      [60, 100],
      [72, 120],
    ];
    for (let i = 0; i < 10; i++) {
      const [r1, r2] = pairs[i];
      const ans = (2 * r1 * r2) / (r1 + r2);
      addIntProblem(out, topic, difficulty, source, `A car travels the same distance out at $${r1}$ mph and back at $${r2}$ mph. What is the average speed for the whole trip?`, ans, [(r1 + r2) / 2, r2 - r1, ans + 2], `For equal distances, average speed is $\\frac{2r_1r_2}{r_1+r_2}=\\frac{2\\cdot ${r1}\\cdot ${r2}}{${r1}+${r2}}=${ans}$.`, 1.35, ["rate", "average-speed"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const slow = 5 * (i + 2);
      const fast = slow + 5;
      const delay = i + 2;
      const ans = (slow * delay) / (fast - slow);
      addIntProblem(out, topic, difficulty, source, `A walker starts at $${slow}$ mph. After $${delay}$ hours, a cyclist starts from the same point at $${fast}$ mph. How many hours after the cyclist starts will the cyclist catch the walker?`, ans, [delay, ans + delay, slow * delay], `The head start is $${slow}\\cdot ${delay}=${slow * delay}$ miles. The catch-up rate is $${fast}-${slow}=5$ mph, so time is $${slow * delay}/5=${ans}$ hours.`, 1.35, ["rate", "catch-up"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const fill = i + 12;
      const leak = i + 5;
      const hours = i + 4;
      const ans = (fill - leak) * hours;
      addIntProblem(out, topic, difficulty, source, `A tank is filled at $${fill}$ gallons per hour while a leak drains $${leak}$ gallons per hour. How many gallons are added to the tank in $${hours}$ hours?`, ans, [fill * hours, leak * hours, ans + leak], `The net rate is $${fill}-${leak}=${fill - leak}$ gallons per hour. In $${hours}$ hours the gain is $${fill - leak}\\cdot ${hours}=${ans}$.`, 1.3, ["rate", "net-rate"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const downstream = i + 15;
      const upstream = i + 9;
      const ans = (downstream - upstream) / 2;
      addIntProblem(out, topic, difficulty, source, `A boat travels $${downstream}$ mph downstream and $${upstream}$ mph upstream in a river. What is the speed of the current in mph?`, ans, [downstream - upstream, (downstream + upstream) / 2, ans + upstream], `Downstream speed is boat speed plus current, and upstream speed is boat speed minus current. The current is $(${downstream}-${upstream})/2=${ans}$.`, 1.35, ["rate", "current"], rng);
    }
    for (let i = 0; i < 10; i++) {
      const train = i + 30;
      const person = i + 3;
      const time = 10;
      const ans = (train - person) * time;
      addIntProblem(out, topic, difficulty, source, `A train moving $${train}$ feet per second passes a person walking in the same direction at $${person}$ feet per second. If passing takes $${time}$ seconds, what is the train's length in feet?`, ans, [train * time, person * time, ans + train], `The relative speed is $${train}-${person}=${train - person}$ feet per second. Length is $${train - person}\\cdot ${time}=${ans}$ feet.`, 1.4, ["rate", "relative-rate"], rng);
    }
  }

  return out;
}

const generators: Record<string, (difficulty: Difficulty, rng: () => number) => Problem[]> = {
  "ch7.direct": direct,
  "ch7.inverse": inverse,
  "ch7.joint": joint,
  "ch7.rate": rate,
};

for (const [topic, generate] of Object.entries(generators)) {
  for (const difficulty of DIFFICULTIES) {
    const rng = createRng(`${topic}.${difficulty}`);
    const problems = generate(difficulty, rng);
    if (problems.length !== 50) {
      throw new Error(`${topic}.${difficulty} generated ${problems.length} problems`);
    }
    const dir = path.join(process.cwd(), "content", "problems", GROUP);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${topic}.${difficulty}.json`);
    fs.writeFileSync(file, JSON.stringify(problems, null, 2));
    console.log(`Wrote ${problems.length} problems to ${file}`);
  }
}
