import {
  type Problem,
  type Difficulty,
  createRng,
  randInt,
  randChoice,
  gcd,
  simplifyTerms,
  formatFracLatex,
  randomUntil,
  makeProblem,
  intDistractors,
  fracDistractors,
  ratioDistractors,
} from "./ch6_common.js";

const topic = "ch6.basic_ratio";
const source = "6.1";

function easy(rng: () => number): Problem[] {
  const diff: Difficulty = "easy";
  const complexity = 0.9;
  const out: Problem[] = [];
  let idx = 1;

  for (let i = 0; i < 10; i++) {
    const a = randInt(rng, 2, 9);
    const b = randInt(rng, 2, 9);
    const k = randInt(rng, 2, 6);
    const A = a * k;
    const B = b * k;
    const g = gcd(A, B);
    const simp = simplifyTerms([A, B]);
    const correct = `${simp[0]}:${simp[1]}`;
    const prompt = `Simplify the ratio $${A}:${B}$.`;
    const solution = `Divide both terms by $${g}$: $${A}:${B} = ${simp[0]}:${simp[1]}$.`;
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
        ["ratio", "simplify"],
        rng
      )
    );
  }

  for (let i = 0; i < 10; i++) {
    const a = randInt(rng, 2, 9);
    const b = randInt(rng, 2, 9);
    const m = randInt(rng, 2, 5);
    const c = a * m;
    const d = b * m;
    const prompt = `Solve for $x$: $${a}:${b} = ${c}:x$.`;
    const solution = `The scale factor is $${m}$, so $x = ${b} \\cdot ${m} = ${d}$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${d}$`,
        `${d}`,
        "integer",
        intDistractors(d, rng, [c + b, a + b, c + m]),
        solution,
        complexity,
        ["ratio", "equivalent"],
        rng
      )
    );
  }

  for (let i = 0; i < 10; i++) {
    const a = randInt(rng, 2, 8);
    const b = randInt(rng, 2, 8);
    const k = randInt(rng, 2, 10);
    const T = (a + b) * k;
    const larger = a > b ? a * k : b * k;
    const smaller = a > b ? b * k : a * k;
    const prompt = `A total of $${T}$ dollars is divided in the ratio $${a}:${b}$. What is the larger share?`;
    const solution = `Each part is $${k}$ dollars, so the shares are $${a * k}$ and $${b * k}$. The larger share is $${larger}$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${larger}$`,
        `${larger}`,
        "integer",
        intDistractors(larger, rng, [T, smaller, Math.floor(T / 2)]),
        solution,
        complexity,
        ["ratio", "sharing"],
        rng
      )
    );
  }

  for (let i = 0; i < 10; i++) {
    const a = randInt(rng, 2, 9);
    const b = randInt(rng, 2, 9);
    const k = randInt(rng, 2, 10);
    const A = a * k;
    const B = b * k;
    const prompt = `The ratio of apples to oranges is $${a}:${b}$. If there are $${A}$ apples, how many oranges are there?`;
    const solution = `The scale factor is $${k}$, so the number of oranges is $${b} \\cdot ${k} = ${B}$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${B}$`,
        `${B}`,
        "integer",
        intDistractors(B, rng, [A, A + b, A - a]),
        solution,
        complexity,
        ["ratio", "word"],
        rng
      )
    );
  }

  for (let i = 0; i < 10; i++) {
    const a = randInt(rng, 2, 8);
    const b = randInt(rng, 2, 8);
    const k = randInt(rng, 2, 8);
    const T = (a + b) * k;
    const [n, d] = simplifyTerms([a, a + b]);
    const correct = `${n}/${d}`;
    const prompt = `In a group of $${T}$ students, the ratio of boys to girls is $${a}:${b}$. What fraction of the students are boys?`;
    const solution = `The fraction of boys is $${a}/(${a}+${b}) = ${formatFracLatex(
      a,
      a + b
    )} = ${formatFracLatex(n, d)}$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${formatFracLatex(n, d)}$`,
        correct,
        "fraction",
        fracDistractors({ n, d }, rng),
        solution,
        complexity,
        ["ratio", "fraction"],
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
    const terms = [
      randInt(rng, 1, 6),
      randInt(rng, 1, 6),
      randInt(rng, 1, 6),
    ];
    if (terms[0] === terms[1] && terms[1] === terms[2]) terms[2]++;
    const k = randInt(rng, 2, 10);
    const T = terms.reduce((a, b) => a + b, 0) * k;
    const largest = Math.max(...terms) * k;
    const prompt = `A total of $${T}$ is divided in the ratio $${terms[0]}:${terms[1]}:${terms[2]}$. What is the largest share?`;
    const solution = `Each part is $${k}$, so the shares are $${terms
      .map((t) => t * k)
      .join("$, $")}$. The largest share is $${largest}$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${largest}$`,
        `${largest}`,
        "integer",
        intDistractors(largest, rng, [T, T - largest, Math.floor(T / 3)]),
        solution,
        complexity,
        ["ratio", "three-part"],
        rng
      )
    );
  }

  for (let i = 0; i < 10; i++) {
    const params = randomUntil(rng, (r) => {
      const a = randInt(r, 2, 6);
      const b = randInt(r, 2, 6);
      const k = randInt(r, 2, 8);
      const x = randInt(r, 1, 12);
      const A = a * k;
      const B = b * k;
      const newA = A + x;
      if (newA <= 0) return null;
      const g = gcd(newA, B);
      const r1 = newA / g;
      const s1 = B / g;
      if (Math.max(r1, s1) > 12) return null;
      return { a, b, k, x, A, B, r1, s1 };
    });
    const prompt = `Two numbers are in the ratio $${params.a}:${params.b}$. After adding $${params.x}$ to the first, the ratio becomes $${params.r1}:${params.s1}$. What was the first number?`;
    const solution = `The original numbers are $${params.A}$ and $${params.B}$. Adding $${params.x}$ gives $${params.A + params.x}:${params.B}$, which simplifies to $${params.r1}:${params.s1}$. The first number was $${params.A}$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${params.A}$`,
        `${params.A}`,
        "integer",
        intDistractors(params.A, rng, [
          params.B,
          params.A + params.x,
          params.x,
        ]),
        solution,
        complexity,
        ["ratio", "change"],
        rng
      )
    );
  }

  for (let i = 0; i < 10; i++) {
    const p = randInt(rng, 2, 6);
    const q = randInt(rng, 2, 6);
    const r = randInt(rng, 2, 6);
    const correctArr = simplifyTerms([p, r]);
    const correct = `${correctArr[0]}:${correctArr[1]}`;
    const prompt = `If $a:b = ${p}:${q}$ and $b:c = ${q}:${r}$, what is $a:c$?`;
    const solution = `The common term $b$ is $${q}$ in both ratios, so $a:c = ${p}:${r}$. In lowest terms this is $${correct}$.`;
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
        ratioDistractors(correctArr, rng),
        solution,
        complexity,
        ["ratio", "combined"],
        rng
      )
    );
  }

  for (let i = 0; i < 10; i++) {
    const a = randInt(rng, 3, 9);
    const b = randInt(rng, 2, a - 1);
    const k = randInt(rng, 2, 10);
    const D = (a - b) * k;
    const larger = a * k;
    const prompt = `Two numbers are in the ratio $${a}:${b}$ and differ by $${D}$. What is the larger number?`;
    const solution = `Each part is $${k}$, so the numbers are $${a * k}$ and $${b * k}$. The larger number is $${larger}$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${larger}$`,
        `${larger}`,
        "integer",
        intDistractors(larger, rng, [D, b * k, (a + b) * k]),
        solution,
        complexity,
        ["ratio", "difference"],
        rng
      )
    );
  }

  for (let i = 0; i < 10; i++) {
    const terms = [
      randInt(rng, 1, 6),
      randInt(rng, 1, 6),
      randInt(rng, 1, 6),
    ];
    if (terms[0] === terms[1] && terms[1] === terms[2]) terms[2]++;
    const g = randInt(rng, 2, 5);
    const big = terms.map((t) => t * g);
    const simp = simplifyTerms(big);
    const correct = `${simp[0]}:${simp[1]}:${simp[2]}`;
    const prompt = `Simplify the ratio $${big[0]}:${big[1]}:${big[2]}$.`;
    const solution = `Divide by $${g}$: $${correct}$.`;
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
        ["ratio", "simplify"],
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

  for (let i = 0; i < 9; i++) {
    const params = randomUntil(rng, (r) => {
      const a = randInt(r, 2, 6);
      const b = randInt(r, 2, 6);
      const k = randInt(r, 2, 8);
      const x = randInt(r, 1, 12);
      const A = a * k;
      const B = b * k;
      const newA = A + x;
      const newB = B + x;
      const g = gcd(newA, newB);
      const r1 = newA / g;
      const s1 = newB / g;
      if (Math.max(r1, s1) > 12) return null;
      return { a, b, k, x, A, B, r1, s1, sum: A + B };
    });
    const prompt = `Two numbers are in the ratio $${params.a}:${params.b}$. After adding $${params.x}$ to each, the ratio becomes $${params.r1}:${params.s1}$. What is the sum of the original numbers?`;
    const solution = `The original numbers are $${params.A}$ and $${params.B}$, so their sum is $${params.sum}$. Adding $${params.x}$ to each gives $${params.A + params.x}:${params.B + params.x}$, which simplifies to $${params.r1}:${params.s1}$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${params.sum}$`,
        `${params.sum}`,
        "integer",
        intDistractors(params.sum, rng, [
          params.A,
          params.B,
          params.sum + 2 * params.x,
        ]),
        solution,
        complexity,
        ["ratio", "change"],
        rng
      )
    );
  }

  for (let i = 0; i < 8; i++) {
    const a = randInt(rng, 1, 6);
    const b = randInt(rng, 1, 6);
    const c = randInt(rng, 1, 6);
    const d = randInt(rng, 1, 6);
    const n = a * d;
    const den = b * c;
    const simp = simplifyTerms([n, den]);
    const correct = `${simp[0]}:${simp[1]}`;
    const prompt = `Simplify the ratio $\\frac{${a}}{${b}} : \\frac{${c}}{${d}}$.`;
    const solution = `Multiply both terms by $${b * d}$: $${a * d}:${b * c}$, which simplifies to $${correct}$.`;
    const originalLatex = `$\\frac{${a}}{${b}} : \\frac{${c}}{${d}}$`;
    const reversed = `${simp[1]}:${simp[0]}`;
    const wrong = `${a * c}:${b * d}`;
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
        [originalLatex, `$${reversed}$`, `$${wrong}$`],
        solution,
        complexity,
        ["ratio", "fraction"],
        rng
      )
    );
  }

  for (let i = 0; i < 9; i++) {
    const terms = [
      randInt(rng, 1, 6),
      randInt(rng, 1, 6),
      randInt(rng, 1, 6),
    ];
    if (terms[0] === terms[1] && terms[1] === terms[2]) terms[2]++;
    const k = randInt(rng, 2, 10);
    const T = terms.reduce((a, b) => a + b, 0) * k;
    const value = 2 * terms[0] * k - terms[1] * k + terms[2] * k;
    const prompt = `Three numbers are in the ratio $${terms[0]}:${terms[1]}:${terms[2]}$ and their sum is $${T}$. What is $2A - B + C$?`;
    const solution = `Each part is $${k}$, so $A = ${terms[0] * k}$, $B = ${terms[1] * k}$, and $C = ${terms[2] * k}$. Then $2A - B + C = ${value}$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${value}$`,
        `${value}`,
        "integer",
        intDistractors(value, rng, [T, terms[0] * k, terms[2] * k]),
        solution,
        complexity,
        ["ratio", "expression"],
        rng
      )
    );
  }

  for (let i = 0; i < 8; i++) {
    const params = randomUntil(rng, (r) => {
      const a = randInt(r, 2, 6);
      const b = randInt(r, 2, 6);
      const k = randInt(r, 2, 8);
      const m = randInt(r, 1, 12);
      const A = a * k;
      const B = b * k;
      if (A <= m) return null;
      const newA = A - m;
      const newB = B + m;
      const g = gcd(newA, newB);
      const r1 = newA / g;
      const s1 = newB / g;
      if (Math.max(r1, s1) > 12) return null;
      return { a, b, k, m, A, B, r1, s1, total: A + B };
    });
    const prompt = `Two boxes have marbles in the ratio $${params.a}:${params.b}$. After moving $${params.m}$ marbles from the first to the second, the ratio becomes $${params.r1}:${params.s1}$. How many marbles were there originally?`;
    const solution = `Originally there were $${params.A}$ and $${params.B}$ marbles, for a total of $${params.total}$. Moving $${params.m}$ gives $${params.A - params.m}:${params.B + params.m}$, which simplifies to $${params.r1}:${params.s1}$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${params.total}$`,
        `${params.total}`,
        "integer",
        intDistractors(params.total, rng, [
          params.A,
          params.B,
          params.total - 2 * params.m,
        ]),
        solution,
        complexity,
        ["ratio", "transfer"],
        rng
      )
    );
  }

  for (let i = 0; i < 8; i++) {
    const params = randomUntil(rng, (r) => {
      const p = randInt(r, 2, 5);
      const q = randInt(r, 2, 5);
      const R = randChoice(r, [20, 25, 40, 50]);
      const S = randChoice(r, [20, 25, 40, 50]);
      const denom = p * R + q * S;
      const G = randInt(r, 20, 120);
      const num = G * 100 * (p + q);
      if (num % denom !== 0) return null;
      const total = num / denom;
      return { p, q, R, S, G, total };
    });
    const prompt = `In a school, the ratio of boys to girls is $${params.p}:${params.q}$. $${params.R}\\%$ of the boys and $${params.S}\\%$ of the girls wear glasses. If $${params.G}$ students wear glasses, how many students are there in total?`;
    const solution = `Let each part be $k$. Glasses wearers equal $0.${params.R}(${params.p}k)+0.${params.S}(${params.q}k) = ${params.G}$, so $k = ${params.total / (params.p + params.q)}$ and the total is $${params.total}$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${params.total}$`,
        `${params.total}`,
        "integer",
        intDistractors(params.total, rng, [
          params.G,
          Math.floor(params.total / 2),
          params.G * 2,
        ]),
        solution,
        complexity,
        ["ratio", "percent"],
        rng
      )
    );
  }

  for (let i = 0; i < 8; i++) {
    const terms = [
      randInt(rng, 2, 12),
      randInt(rng, 2, 12),
      randInt(rng, 2, 12),
    ];
    const g = randInt(rng, 2, 4);
    const scaled = terms.map((t) => t / 10);
    const simp = simplifyTerms(terms);
    const correct = `${simp[0]}:${simp[1]}:${simp[2]}`;
    const prompt = `Simplify the ratio $${scaled[0]}:${scaled[1]}:${scaled[2]}$.`;
    const solution = `Multiply by $10$ to get $${terms[0]}:${terms[1]}:${terms[2]}$, then divide by $${g}$: $${correct}$.`;
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
        ["ratio", "decimal"],
        rng
      )
    );
  }

  return out;
}

export function generate(rng: () => number): Record<Difficulty, Problem[]> {
  return { easy: easy(rng), medium: medium(rng), hard: hard(rng) };
}
