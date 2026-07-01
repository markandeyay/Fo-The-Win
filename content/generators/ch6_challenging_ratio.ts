import {
  type Problem,
  type Difficulty,
  randInt,
  randChoice,
  gcd,
  lcm,
  simplifyTerms,
  randomUntil,
  makeProblem,
  intDistractors,
  ratioDistractors,
} from "./ch6_common.js";

const topic = "ch6.challenging_ratio";
const source = "6.2";

function easy(rng: () => number): Problem[] {
  const diff: Difficulty = "easy";
  const complexity = 0.95;
  const out: Problem[] = [];
  let idx = 1;

  for (let i = 0; i < 10; i++) {
    const a = randInt(rng, 2, 8);
    const b = randInt(rng, 2, 8);
    const k = randInt(rng, 2, 10);
    const total = (a + b) * k;
    const larger = Math.max(a, b) * k;
    const prompt = `Two numbers are in the ratio $${a}:${b}$. The larger number is $${larger}$. What is their sum?`;
    const solution = `Each part is $${k}$, so the numbers are $${a * k}$ and $${b * k}$. Their sum is $${total}$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${total}$`,
        `${total}`,
        "integer",
        intDistractors(total, rng, [larger, total - larger, larger * 2]),
        solution,
        complexity,
        ["ratio", "sum"],
        rng
      )
    );
  }

  for (let i = 0; i < 10; i++) {
    const a = randInt(rng, 3, 9);
    const b = randInt(rng, 2, a - 1);
    const k = randInt(rng, 3, 12);
    const A = a * k;
    const B = b * k;
    const prompt = `A father and his son are in the ratio of ages $${a}:${b}$. If the father is $${A}$ years old, how old is the son?`;
    const solution = `The scale factor is $${A} \\div ${a} = ${k}$, so the son is $${b} \\cdot ${k} = ${B}$ years old.`;
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
        intDistractors(B, rng, [A, A - B, A + B]),
        solution,
        complexity,
        ["ratio", "age"],
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
      if (B <= x) return null;
      const newB = B - x;
      const g = gcd(A, newB);
      const r1 = A / g;
      const s1 = newB / g;
      if (Math.max(r1, s1) > 12) return null;
      return { a, b, k, x, A, B, r1, s1, total: A + B };
    });
    const prompt = `Two numbers are in the ratio $${params.a}:${params.b}$. After subtracting $${params.x}$ from the second, the ratio becomes $${params.r1}:${params.s1}$. What was the original sum?`;
    const solution = `Originally the numbers are $${params.A}$ and $${params.B}$, so their sum is $${params.total}$. Subtracting $${params.x}$ from the second gives $${params.A}:${params.B - params.x}$, which simplifies to $${params.r1}:${params.s1}$.`;
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
          params.total - params.x,
        ]),
        solution,
        complexity,
        ["ratio", "change"],
        rng
      )
    );
  }

  for (let i = 0; i < 10; i++) {
    const a = randInt(rng, 2, 8);
    const b = randInt(rng, 2, 8);
    const k = randInt(rng, 2, 10);
    const A = a * k;
    const B = b * k;
    const prompt = `A recipe uses flour and sugar in the ratio $${a}:${b}$. If $${A}$ cups of flour are used, how many cups of sugar are needed?`;
    const solution = `The scale factor is $${k}$, so the sugar needed is $${b} \\cdot ${k} = ${B}$ cups.`;
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
    const k = randInt(rng, 2, 10);
    const A = a * k;
    const B = b * k;
    const prompt = `On a map, two cities are $${A}$ miles apart and the map scale is $${a}:${b}$ miles per unit. How many miles apart would two cities be if the map distance is $${b}$ units?`;
    const solution = `The scale factor is $${k}$, so the actual distance is $${B}$ miles.`;
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
        intDistractors(B, rng, [A, A + b, A * 2]),
        solution,
        complexity,
        ["ratio", "scale"],
        rng
      )
    );
  }

  return out;
}

function medium(rng: () => number): Problem[] {
  const diff: Difficulty = "medium";
  const complexity = 1.05;
  const out: Problem[] = [];
  let idx = 1;

  for (let i = 0; i < 10; i++) {
    const p = randInt(rng, 2, 6);
    const q = randInt(rng, 2, 6);
    const r = randInt(rng, 2, 6);
    const combined = simplifyTerms([p, q, r]);
    const correct = `${combined[0]}:${combined[1]}:${combined[2]}`;
    const prompt = `If $a:b = ${p}:${q}$ and $b:c = ${q}:${r}$, what is $a:b:c$?`;
    const solution = `The common middle term is $${q}$, so $a:b:c = ${p}:${q}:${r}$, which simplifies to $${correct}$.`;
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
        ratioDistractors(combined, rng),
        solution,
        complexity,
        ["ratio", "combined"],
        rng
      )
    );
  }

  for (let i = 0; i < 10; i++) {
    const params = randomUntil(rng, (r) => {
      const a = randInt(r, 2, 6);
      const b = randInt(r, 2, 6);
      const k = randInt(r, 2, 8);
      const t = randInt(r, 2, 15);
      const A = a * k;
      const B = b * k;
      const newA = A + t;
      const newB = B + t;
      const g = gcd(newA, newB);
      const r1 = newA / g;
      const s1 = newB / g;
      if (Math.max(r1, s1) > 12) return null;
      return { a, b, k, t, A, B, r1, s1 };
    });
    const prompt = `The present ages of two people are in the ratio $${params.a}:${params.b}$. In $${params.t}$ years, their ages will be in the ratio $${params.r1}:${params.s1}$. How old is the first person now?`;
    const solution = `Their present ages are $${params.A}$ and $${params.B}$. In $${params.t}$ years they will be $${params.A + params.t}:${params.B + params.t}$, which simplifies to $${params.r1}:${params.s1}$. The first person is $${params.A}$ now.`;
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
          params.A + params.t,
          params.t,
        ]),
        solution,
        complexity,
        ["ratio", "age"],
        rng
      )
    );
  }

  for (let i = 0; i < 10; i++) {
    const p = randInt(rng, 3, 8);
    const q = randInt(rng, 2, p - 1);
    const k = randInt(rng, 2, 10);
    const diffAmount = (p - q) * k;
    const total = (p + q) * k;
    const prompt = `Two people share money in the ratio $${p}:${q}$, and the first person receives $${diffAmount}$ dollars more than the second. What is the total amount shared?`;
    const solution = `Each part is $${k}$ dollars, so the shares are $${p * k}$ and $${q * k}$. The difference is $${diffAmount}$, and the total is $${total}$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${total}$`,
        `${total}`,
        "integer",
        intDistractors(total, rng, [diffAmount, p * k, q * k]),
        solution,
        complexity,
        ["ratio", "sharing"],
        rng
      )
    );
  }

  for (let i = 0; i < 10; i++) {
    const a = randInt(rng, 3, 9);
    const b = randInt(rng, 2, a - 1);
    const k = randInt(rng, 2, 10);
    const D = (a - b) * k;
    const total = (a + b) * k;
    const prompt = `Two numbers are in the ratio $${a}:${b}$, and one number is $${D}$ more than the other. What is the sum of the two numbers?`;
    const solution = `The numbers are $${a * k}$ and $${b * k}$. Their sum is $${total}$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${total}$`,
        `${total}`,
        "integer",
        intDistractors(total, rng, [D, a * k, b * k]),
        solution,
        complexity,
        ["ratio", "difference"],
        rng
      )
    );
  }

  for (let i = 0; i < 10; i++) {
    const params = randomUntil(rng, (r) => {
      const a = randInt(r, 3, 7);
      const b = randInt(r, 2, a - 1);
      const k = randInt(r, 2, 8);
      const s = randInt(r, 1, Math.min(a * k, b * k) - 1);
      const A = a * k;
      const B = b * k;
      const newA = A - s;
      const newB = B - s;
      const g = gcd(newA, newB);
      const r1 = newA / g;
      const s1 = newB / g;
      if (Math.max(r1, s1) > 12) return null;
      return { a, b, k, s, A, B, r1, s1, total: A + B };
    });
    const prompt = `Two numbers are in the ratio $${params.a}:${params.b}$. After subtracting $${params.s}$ from each, the ratio becomes $${params.r1}:${params.s1}$. What was the original sum?`;
    const solution = `Originally the numbers are $${params.A}$ and $${params.B}$, so their sum is $${params.total}$. Subtracting $${params.s}$ from each gives $${params.A - params.s}:${params.B - params.s}$, which simplifies to $${params.r1}:${params.s1}$.`;
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
          params.total - 2 * params.s,
        ]),
        solution,
        complexity,
        ["ratio", "change"],
        rng
      )
    );
  }

  return out;
}

function hard(rng: () => number): Problem[] {
  const diff: Difficulty = "hard";
  const complexity = 1.15;
  const out: Problem[] = [];
  let idx = 1;

  for (let i = 0; i < 8; i++) {
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
    const solution = `Each part is $${k}$, so the numbers are $${terms[0] * k}$, $${terms[1] * k}$, and $${terms[2] * k}$. Then $2A - B + C = ${value}$.`;
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
    const a = randInt(rng, 2, 6);
    const b = randInt(rng, 2, 6);
    const c = randInt(rng, 2, 6);
    const n1 = b * c;
    const n2 = a * c;
    const n3 = a * b;
    const simp = simplifyTerms([n1, n2, n3]);
    const correct = `${simp[0]}:${simp[1]}:${simp[2]}`;
    const prompt = `Simplify the ratio $\\frac{1}{${a}} : \\frac{1}{${b}} : \\frac{1}{${c}}$.`;
    const solution = `Multiply by $${a * b * c}$ to get $${n1}:${n2}:${n3}$, which simplifies to $${correct}$.`;
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
        ["ratio", "fraction"],
        rng
      )
    );
  }

  for (let i = 0; i < 8; i++) {
    const params = randomUntil(rng, (r) => {
      const a = randInt(r, 2, 5);
      const b = randInt(r, 2, 5);
      const c = randInt(r, 2, 5);
      const d = randInt(r, 2, 5);
      const w = lcm(a + b, c + d);
      const copperA = (w * a) / (a + b);
      const copperB = (w * c) / (c + d);
      const copper = copperA + copperB;
      const zinc = 2 * w - copper;
      const g = gcd(copper, zinc);
      const r1 = copper / g;
      const s1 = zinc / g;
      if (Math.max(r1, s1) > 15) return null;
      return { a, b, c, d, w, r1, s1, copper, zinc };
    });
    const prompt = `Alloy A has copper to zinc ratio $${params.a}:${params.b}$, and alloy B has copper to zinc ratio $${params.c}:${params.d}$. If equal weights of the two alloys are melted together, what is the resulting ratio of copper to zinc?`;
    const solution = `Using $${params.w}$ kg of each alloy, the total copper is $${params.copper}$ kg and the total zinc is $${params.zinc}$ kg. The ratio simplifies to $${params.r1}:${params.s1}$.`;
    const correct = `${params.r1}:${params.s1}`;
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
        ratioDistractors([params.r1, params.s1], rng),
        solution,
        complexity,
        ["ratio", "mixture"],
        rng
      )
    );
  }

  for (let i = 0; i < 8; i++) {
    const params = randomUntil(rng, (r) => {
      const a = randInt(r, 2, 6);
      const b = randInt(r, 2, 6);
      const k = randInt(r, 2, 8);
      const p = randInt(r, 1, 12);
      const q = randInt(r, 1, 12);
      const A = a * k;
      const B = b * k;
      const newA = A + p;
      const newB = B + q;
      const g = gcd(newA, newB);
      const r1 = newA / g;
      const s1 = newB / g;
      if (Math.max(r1, s1) > 12) return null;
      return { a, b, k, p, q, A, B, r1, s1, total: A + B };
    });
    const prompt = `Two numbers are in the ratio $${params.a}:${params.b}$. After adding $${params.p}$ to the first and $${params.q}$ to the second, the ratio becomes $${params.r1}:${params.s1}$. What was the original sum?`;
    const solution = `The original numbers are $${params.A}$ and $${params.B}$, so their sum is $${params.total}$. Adding gives $${params.A + params.p}:${params.B + params.q}$, which simplifies to $${params.r1}:${params.s1}$.`;
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
          params.A + params.p,
          params.B + params.q,
          params.total + params.p + params.q,
        ]),
        solution,
        complexity,
        ["ratio", "change"],
        rng
      )
    );
  }

  for (let i = 0; i < 9; i++) {
    const terms = [
      randInt(rng, 2, 6),
      randInt(rng, 2, 6),
      randInt(rng, 2, 6),
    ];
    if (terms[0] === terms[1] && terms[1] === terms[2]) terms[2]++;
    const k = randInt(rng, 2, 10);
    const P = terms.reduce((a, b) => a + b, 0) * k;
    const longest = Math.max(...terms) * k;
    const prompt = `The sides of a triangle are in the ratio $${terms[0]}:${terms[1]}:${terms[2]}$ and its perimeter is $${P}$. What is the length of the longest side?`;
    const solution = `Each part is $${k}$, so the sides are $${terms
      .map((t) => t * k)
      .join("$, $")}$. The longest side is $${longest}$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${longest}$`,
        `${longest}`,
        "integer",
        intDistractors(longest, rng, [P, P - longest, Math.floor(P / 2)]),
        solution,
        complexity,
        ["ratio", "geometry"],
        rng
      )
    );
  }

  for (let i = 0; i < 9; i++) {
    const params = (() => {
      for (let attempt = 0; attempt < 200; attempt++) {
        const a = randInt(rng, 2, 5);
        const b = randInt(rng, 2, 5);
        const c = randInt(rng, 2, 5);
        const d = randInt(rng, 2, 5);
        const T = randInt(rng, 20, 80);
        const x = randInt(rng, 1, T - 1);
        const den = (a + b) * (c + d);
        const copperNum = x * a * (c + d) + (T - x) * c * (a + b);
        const totalNum = T * den;
        const zincNum = totalNum - copperNum;
        if (copperNum <= 0 || zincNum <= 0) continue;
        const g = gcd(copperNum, zincNum);
        const m = copperNum / g;
        const n = zincNum / g;
        if (Math.max(m, n) > 30) continue;
        return { a, b, c, d, m, n, T, x };
      }
      return { a: 2, b: 3, c: 3, d: 2, m: 1, n: 1, T: 50, x: 20 };
    })();
    const prompt = `An alloy is made by mixing alloy A (copper to zinc ratio $${params.a}:${params.b}$) and alloy B (copper to zinc ratio $${params.c}:${params.d}$). How many kilograms of alloy A are needed to make $${params.T}$ kg of alloy with copper to zinc ratio $${params.m}:${params.n}$?`;
    const solution = `Let $x$ be the kilograms of alloy A. Then $x \\cdot \\frac{${params.a}}{${params.a + params.b}} + (${params.T}-x) \\cdot \\frac{${params.c}}{${params.c + params.d}} = ${params.T} \\cdot \\frac{${params.m}}{${params.m + params.n}}$, giving $x = ${params.x}$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${params.x}$`,
        `${params.x}`,
        "integer",
        intDistractors(params.x, rng, [
          params.T - params.x,
          Math.floor(params.T / 2),
          params.T,
        ]),
        solution,
        complexity,
        ["ratio", "mixture"],
        rng
      )
    );
  }

  return out;
}

export function generate(rng: () => number): Record<Difficulty, Problem[]> {
  return { easy: easy(rng), medium: medium(rng), hard: hard(rng) };
}
