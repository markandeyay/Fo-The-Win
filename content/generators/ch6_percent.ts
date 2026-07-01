import {
  type Problem,
  type Difficulty,
  type AnswerType,
  randInt,
  randChoice,
  gcd,
  simplifyTerms,
  formatFracLatex,
  makeProblem,
  intDistractors,
  fracDistractors,
  decimalDistractors,
  ratioDistractors,
} from "./ch6_common.js";

const topic = "ch6.percent";
const source = "6.4";

function easy(rng: () => number): Problem[] {
  const diff: Difficulty = "easy";
  const complexity = 0.9;
  const out: Problem[] = [];
  let idx = 1;

  for (let i = 0; i < 10; i++) {
    const P = randInt(rng, 1, 99);
    const ans = P / 100;
    const prompt = `Write $${P}\\%$ as a decimal.`;
    const solution = `$${P}\\% = ${P}/100 = ${ans}$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${ans}$`,
        `${ans}`,
        "decimal",
        decimalDistractors(ans, rng),
        solution,
        complexity,
        ["percent", "decimal"],
        rng
      )
    );
  }

  const nicePercents = [10, 20, 25, 40, 50, 60, 75, 80];
  for (let i = 0; i < 10; i++) {
    const P = randChoice(rng, nicePercents);
    const [n, d] = simplifyTerms([P, 100]);
    const correct = `${n}/${d}`;
    const prompt = `Write $${P}\\%$ as a fraction in lowest terms.`;
    const solution = `$${P}\\% = \\frac{${P}}{100} = \\frac{${n}}{${d}}$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$\\frac{${n}}{${d}}$`,
        correct,
        "fraction",
        fracDistractors({ n, d }, rng),
        solution,
        complexity,
        ["percent", "fraction"],
        rng
      )
    );
  }

  for (let i = 0; i < 8; i++) {
    const D = randInt(rng, 1, 99) / 100;
    const ans = Math.round(D * 100);
    const prompt = `Write $${D}$ as a percent.`;
    const solution = `$${D} \\times 100 = ${ans}\\%$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${ans}\\%$`,
        `${ans}`,
        "integer",
        intDistractors(ans, rng, [D, ans * 10, ans / 10]),
        solution,
        complexity,
        ["percent", "decimal"],
        rng
      )
    );
  }

  const easyPercents = [5, 10, 20, 25, 50];
  for (let i = 0; i < 11; i++) {
    const P = randChoice(rng, easyPercents);
    const N = randInt(rng, 2, 40) * (100 / gcd(P, 100));
    const ans = (P * N) / 100;
    const prompt = `What is $${P}\\%$ of $${N}$?`;
    const solution = `$${P}\\%$ of $${N}$ is $0.${P} \\times ${N} = ${ans}$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${ans}$`,
        `${ans}`,
        "integer",
        intDistractors(ans, rng, [N - ans, N + ans, Math.floor(N / P)]),
        solution,
        complexity,
        ["percent", "of"],
        rng
      )
    );
  }

  for (let i = 0; i < 11; i++) {
    const k = randChoice(rng, [2, 4, 5, 10, 20, 25, 50]);
    const A = randInt(rng, 1, 50);
    const B = A * k;
    const ans = 100 / k;
    const prompt = `$${A}$ is what percent of $${B}$?`;
    const solution = `$\\frac{${A}}{${B}} = \\frac{1}{${k}} = ${ans}\\%$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${ans}\\%$`,
        `${ans}`,
        "integer",
        intDistractors(ans, rng, [A, k, B / 100]),
        solution,
        complexity,
        ["percent", "what-percent"],
        rng
      )
    );
  }

  return out;
}

function medium(rng: () => number): Problem[] {
  const diff: Difficulty = "medium";
  const complexity = 1.0;
  const out: Problem[] = [];
  let idx = 1;

  for (let i = 0; i < 10; i++) {
    const P = randInt(rng, 110, 200);
    const N = randInt(rng, 2, 30) * (100 / gcd(P, 100));
    const ans = (P * N) / 100;
    const prompt = `What is $${P}\\%$ of $${N}$?`;
    const solution = `$${P}\\%$ of $${N}$ is $${P / 100} \\times ${N} = ${ans}$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${ans}$`,
        `${ans}`,
        "integer",
        intDistractors(ans, rng, [N + ans, N, Math.floor(ans / 2)]),
        solution,
        complexity,
        ["percent", "greater-100"],
        rng
      )
    );
  }

  for (let i = 0; i < 10; i++) {
    const P = randChoice(rng, [25, 50, 20, 10, 75]);
    const num = randInt(rng, 1, 9);
    const den = randInt(rng, 2, 9);
    const rawNum = P * num;
    const rawDen = 100 * den;
    const g = gcd(rawNum, rawDen);
    const n = rawNum / g;
    const d = rawDen / g;
    const correct = `${n}/${d}`;
    const prompt = `What is $${P}\\%$ of $\\frac{${num}}{${den}}$?`;
    const solution = `$${P}\\% \\cdot \\frac{${num}}{${den}} = \\frac{${P}}{100} \\cdot \\frac{${num}}{${den}} = \\frac{${n}}{${d}}$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$\\frac{${n}}{${d}}$`,
        correct,
        "fraction",
        fracDistractors({ n, d }, rng),
        solution,
        complexity,
        ["percent", "fraction"],
        rng
      )
    );
  }

  for (let i = 0; i < 10; i++) {
    const a = randInt(rng, 1, 8);
    const b = randInt(rng, 2, 8);
    const c = randInt(rng, 1, 8);
    const d = randInt(rng, 2, 8);
    const raw = ((a / b) / (c / d)) * 100;
    if (!Number.isInteger(raw)) {
      i--;
      continue;
    }
    const ans = raw;
    const prompt = `$\\frac{${a}}{${b}}$ is what percent of $\\frac{${c}}{${d}}$?`;
    const solution = `$\\frac{${a}}{${b}} \\div \\frac{${c}}{${d}} = \\frac{${a * d}}{${b * c}} = ${formatFracLatex(
      a * d,
      b * c
    )}$, which is $${ans}\\%$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${ans}\\%$`,
        `${ans}`,
        "integer",
        intDistractors(ans, rng, [a * d, b * c, ans / 2]),
        solution,
        complexity,
        ["percent", "fraction"],
        rng
      )
    );
  }

  for (let i = 0; i < 10; i++) {
    const O = randInt(rng, 20, 100);
    const p = randChoice(rng, [10, 20, 25, 30, 50]);
    const increase = rng() > 0.5;
    const N = increase ? O * (1 + p / 100) : O * (1 - p / 100);
    if (!Number.isInteger(N)) {
      i--;
      continue;
    }
    const ans = p;
    const prompt = increase
      ? `A quantity increases from $${O}$ to $${N}$. What is the percent increase?`
      : `A quantity decreases from $${O}$ to $${N}$. What is the percent decrease?`;
    const solution = `$\\frac{|${N}-${O}|}{${O}} \\times 100 = ${ans}\\%$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${ans}\\%$`,
        `${ans}`,
        "integer",
        intDistractors(ans, rng, [N - O, O - N, Math.floor(ans / 2)]),
        solution,
        complexity,
        ["percent", "change"],
        rng
      )
    );
  }

  for (let i = 0; i < 10; i++) {
    const P = randChoice(rng, [5, 8, 10, 20, 25, 40, 50]);
    const ans = randInt(rng, 5, 60);
    const A = (P * ans) / 100;
    const prompt = `$${P}\\%$ of what number is $${A}$?`;
    const solution = `Let $x$ be the number. Then $0.${P}x = ${A}$, so $x = ${A} \\div 0.${P} = ${ans}$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${ans}$`,
        `${ans}`,
        "integer",
        intDistractors(ans, rng, [A, A * 2, ans + 10]),
        solution,
        complexity,
        ["percent", "reverse"],
        rng
      )
    );
  }

  return out;
}

function hard(rng: () => number): Problem[] {
  const diff: Difficulty = "hard";
  const complexity = 1.1;
  const out: Problem[] = [];
  let idx = 1;

  for (let i = 0; i < 10; i++) {
    const P = randChoice(rng, [10, 20, 25, 50]);
    const ans = randInt(rng, 20, 100);
    const R = Math.round(ans * (1 + P / 100));
    const prompt = `After a number is increased by $${P}\\%$, the result is $${R}$. What was the original number?`;
    const solution = `Let $x$ be the original. Then $x \\cdot ${1 + P / 100} = ${R}$, so $x = ${R} \\div ${1 + P / 100} = ${ans}$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${ans}$`,
        `${ans}`,
        "integer",
        intDistractors(ans, rng, [R, R - ans, ans + P]),
        solution,
        complexity,
        ["percent", "reverse"],
        rng
      )
    );
  }

  const fracPercents: { label: string; num: number; den: number }[] = [
    { label: "12.5", num: 1, den: 8 },
    { label: "37.5", num: 3, den: 8 },
    { label: "62.5", num: 5, den: 8 },
    { label: "87.5", num: 7, den: 8 },
  ];
  for (let i = 0; i < 10; i++) {
    const fp = randChoice(rng, fracPercents);
    const N = randInt(rng, 8, 80);
    const ans = (N * fp.num) / fp.den;
    if (!Number.isInteger(ans)) {
      i--;
      continue;
    }
    const prompt = `What is $${fp.label}\\%$ of $${N}$?`;
    const solution = `$${fp.label}\\% = \\frac{${fp.num}}{${fp.den}}$, so $${fp.label}\\%$ of $${N}$ is $\\frac{${fp.num}}{${fp.den}} \\cdot ${N} = ${ans}$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${ans}$`,
        `${ans}`,
        "integer",
        intDistractors(ans, rng, [N / fp.den, N - ans, ans * 2]),
        solution,
        complexity,
        ["percent", "fraction"],
        rng
      )
    );
  }

  for (let i = 0; i < 10; i++) {
    const P = randChoice(rng, [10, 20, 50]);
    const ans = -Math.round((P * P) / 100);
    const prompt = `A number is increased by $${P}\\%$ and then decreased by $${P}\\%$. What is the net percent change?`;
    const solution = `The multiplier is $(1+${P / 100})(1-${P / 100}) = ${1 - (P * P) / 10000}$, so the net change is $${ans}\\%$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${ans}\\%$`,
        `${ans}`,
        "integer",
        intDistractors(ans, rng, [0, -P, P, ans * 2]),
        solution,
        complexity,
        ["percent", "compound"],
        rng
      )
    );
  }

  for (let i = 0; i < 10; i++) {
    const P = randInt(rng, 20, 80);
    const boys = 100 - P;
    const simp = simplifyTerms([boys, P]);
    const correct = `${simp[0]}:${simp[1]}`;
    const prompt = `In a class, $${P}\\%$ of the students are girls. What is the ratio of boys to girls?`;
    const solution = `Boys make up $${boys}\\%$, so the ratio of boys to girls is $${boys}:${P}$, which simplifies to $${correct}$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${correct}$`,
        correct,
        "string",
        ratioDistractors(simp, rng),
        solution,
        complexity,
        ["percent", "ratio"],
        rng
      )
    );
  }

  for (let i = 0; i < 10; i++) {
    const P = randChoice(rng, [10, 20, 25, 30, 40, 50]);
    const ans = randInt(rng, 20, 120);
    const F = Math.round(ans * (1 - P / 100));
    const prompt = `After a $${P}\\%$ discount, an item costs $${F}$ dollars. What was the original price?`;
    const solution = `Let $x$ be the original price. Then $x \\cdot ${1 - P / 100} = ${F}$, so $x = ${F} \\div ${1 - P / 100} = ${ans}$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${ans}$`,
        `${ans}`,
        "integer",
        intDistractors(ans, rng, [F, F + P, ans + P]),
        solution,
        complexity,
        ["percent", "reverse"],
        rng
      )
    );
  }

  return out;
}

export function generate(rng: () => number): Record<Difficulty, Problem[]> {
  return { easy: easy(rng), medium: medium(rng), hard: hard(rng) };
}
