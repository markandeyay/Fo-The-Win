import {
  type Problem,
  type Difficulty,
  randInt,
  randChoice,
  gcd,
  makeProblem,
  intDistractors,
  decimalDistractors,
} from "./ch6_common.js";

const topic = "ch6.percentage_problems";
const source = "6.5";

function easy(rng: () => number): Problem[] {
  const diff: Difficulty = "easy";
  const complexity = 0.9;
  const out: Problem[] = [];
  let idx = 1;

  for (let i = 0; i < 9; i++) {
    const rate = randChoice(rng, [10, 15, 20]);
    const factor = 100 / gcd(rate, 100);
    const bill = randInt(rng, 2, 10) * factor;
    const ans = (bill * rate) / 100;
    const prompt = `What is a $${rate}\\%$ tip on a $${bill}$ dollar bill?`;
    const solution = `$${rate}\\%$ of $${bill}$ is $${rate / 100} \\times ${bill} = ${ans}$ dollars.`;
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
        intDistractors(ans, rng, [bill, bill - ans, ans + 1]),
        solution,
        complexity,
        ["percentage", "tip"],
        rng
      )
    );
  }

  for (let i = 0; i < 9; i++) {
    const price = randInt(rng, 20, 200);
    const rate = randChoice(rng, [5, 8, 10]);
    const factor = 100 / gcd(rate, 100);
    const P = price % factor === 0 ? price : Math.ceil(price / factor) * factor;
    const ans = (P * rate) / 100;
    const prompt = `What is the sales tax on a $${P}$ dollar purchase if the tax rate is $${rate}\\%$?`;
    const solution = `$${rate}\\%$ of $${P}$ is $${rate / 100} \\times ${P} = ${ans}$ dollars.`;
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
        intDistractors(ans, rng, [P, P - ans, ans + rate]),
        solution,
        complexity,
        ["percentage", "tax"],
        rng
      )
    );
  }

  for (let i = 0; i < 9; i++) {
    const O = randInt(rng, 20, 200);
    const D = randChoice(rng, [10, 20, 25, 30, 50]);
    const factor = 100 / gcd(D, 100);
    const price = Math.ceil(O / factor) * factor;
    const ans = price * (1 - D / 100);
    const prompt = `What is the sale price of a $${price}$ dollar item after a $${D}\\%$ discount?`;
    const solution = `You pay $${100 - D}\\%$ of $${price}$: $0.${100 - D} \\times ${price} = ${ans}$ dollars.`;
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
        intDistractors(ans, rng, [price, D, price - D]),
        solution,
        complexity,
        ["percentage", "discount"],
        rng
      )
    );
  }

  for (let i = 0; i < 9; i++) {
    const C = randInt(rng, 20, 200);
    const M = randChoice(rng, [20, 30, 50]);
    const factor = 100 / gcd(M, 100);
    const cost = Math.ceil(C / factor) * factor;
    const ans = cost * (1 + M / 100);
    const prompt = `A store buys an item for $${cost}$ dollars and marks it up by $${M}\\%$. What is the selling price?`;
    const solution = `The selling price is $${cost} \\times ${1 + M / 100} = ${ans}$ dollars.`;
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
        intDistractors(ans, rng, [cost, M, cost + M]),
        solution,
        complexity,
        ["percentage", "markup"],
        rng
      )
    );
  }

  for (let i = 0; i < 8; i++) {
    const P = randInt(rng, 100, 1000);
    const R = randInt(rng, 2, 10);
    const T = randInt(rng, 1, 5);
    const factor = 100 / gcd(P * R * T, 100);
    const principal = Math.ceil(P / factor) * factor;
    const ans = (principal * R * T) / 100;
    const prompt = `Find the simple interest on $${principal}$ dollars at $${R}\\%$ per year for $${T}$ years.`;
    const solution = `Simple interest is $I = PRT = ${principal} \\cdot ${R} \\cdot ${T} / 100 = ${ans}$ dollars.`;
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
        intDistractors(ans, rng, [principal, R * T, ans + R]),
        solution,
        complexity,
        ["percentage", "interest"],
        rng
      )
    );
  }

  for (let i = 0; i < 6; i++) {
    const sales = randInt(rng, 100, 500);
    const rate = randChoice(rng, [5, 10, 15]);
    const factor = 100 / gcd(rate, 100);
    const S = Math.ceil(sales / factor) * factor;
    const ans = (S * rate) / 100;
    const prompt = `A salesperson earns a $${rate}\\%$ commission on $${S}$ dollars in sales. What is the commission?`;
    const solution = `$${rate}\\%$ of $${S}$ is $${rate / 100} \\times ${S} = ${ans}$ dollars.`;
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
        intDistractors(ans, rng, [S, S - ans, ans + rate]),
        solution,
        complexity,
        ["percentage", "commission"],
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
    const price = randChoice(rng, [80, 100, 120, 150, 200]);
    const D = randChoice(rng, [10, 20, 25, 30]);
    const T = randChoice(rng, [5, 8, 10]);
    const final = parseFloat(
      (price * (1 - D / 100) * (1 + T / 100)).toFixed(2)
    );
    const prompt = `An item priced at $${price}$ dollars is discounted by $${D}\\%$, and then sales tax of $${T}\\%$ is added. What is the final price?`;
    const solution = `After the discount the price is $${price} \\times ${1 - D / 100} = ${price * (1 - D / 100)}$. After tax it is $${price * (1 - D / 100)} \\times ${1 + T / 100} = ${final}$ dollars.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${final}$`,
        `${final}`,
        "decimal",
        decimalDistractors(final, rng),
        solution,
        complexity,
        ["percentage", "discount", "tax"],
        rng
      )
    );
  }

  for (let i = 0; i < 10; i++) {
    const D = randChoice(rng, [10, 20, 25, 30, 40, 50]);
    const ans = randInt(rng, 20, 120);
    const F = Math.round(ans * (1 - D / 100));
    const prompt = `After a $${D}\\%$ discount, an item costs $${F}$ dollars. What was the original price?`;
    const solution = `Let $x$ be the original price. Then $x \\cdot ${1 - D / 100} = ${F}$, so $x = ${F} \\div ${1 - D / 100} = ${ans}$ dollars.`;
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
        intDistractors(ans, rng, [F, F + D, ans + D]),
        solution,
        complexity,
        ["percentage", "reverse"],
        rng
      )
    );
  }

  for (let i = 0; i < 10; i++) {
    const P = randInt(rng, 100, 1000);
    const T = randInt(rng, 2, 5);
    const R = randInt(rng, 2, 12);
    const I = (P * R * T) / 100;
    if (!Number.isInteger(I)) {
      i--;
      continue;
    }
    const prompt = `The simple interest on $${P}$ dollars over $${T}$ years is $${I}$ dollars. What is the annual interest rate?`;
    const solution = `Using $I = PRT$, $R = 100I / (PT) = 100 \\cdot ${I} / (${P} \\cdot ${T}) = ${R}\\%$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${R}\\%$`,
        `${R}`,
        "integer",
        intDistractors(R, rng, [I, T, R * 2]),
        solution,
        complexity,
        ["percentage", "interest"],
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
    const context = increase ? "increased" : "decreased";
    const prompt = `A city's population ${context} from $${O}$ thousand to $${N}$ thousand. What was the percent ${context}?`;
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
        ["percentage", "change"],
        rng
      )
    );
  }

  for (let i = 0; i < 10; i++) {
    const p1 = randChoice(rng, [10, 15, 20, 25]);
    const p2 = randChoice(rng, [5, 10, 15, 20]);
    const raw = ((1 + p1 / 100) * (1 + p2 / 100) - 1) * 100;
    const ans = parseFloat(raw.toFixed(1));
    const prompt = `A salary is increased by $${p1}\\%$ and then by $${p2}\\%$. What is the total percent increase?`;
    const solution = `The combined multiplier is $${1 + p1 / 100} \\times ${1 + p2 / 100} = ${(
      (1 + p1 / 100) *
      (1 + p2 / 100)
    ).toFixed(4)}$, so the total increase is $${ans}\\%$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${ans}\\%$`,
        `${ans}`,
        "decimal",
        decimalDistractors(ans, rng),
        solution,
        complexity,
        ["percentage", "successive"],
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
    const M = randChoice(rng, [20, 25, 30, 50]);
    const ans = randInt(rng, 20, 120);
    const S = Math.round(ans * (1 + M / 100));
    const prompt = `A store sells an item for $${S}$ dollars after a markup of $${M}\\%$. What was the cost?`;
    const solution = `Let $x$ be the cost. Then $x \\cdot ${1 + M / 100} = ${S}$, so $x = ${S} \\div ${1 + M / 100} = ${ans}$ dollars.`;
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
        intDistractors(ans, rng, [S, S - ans, ans + M]),
        solution,
        complexity,
        ["percentage", "reverse"],
        rng
      )
    );
  }

  for (let i = 0; i < 10; i++) {
    const drop = randChoice(rng, [10, 20, 25, 50]);
    const rise = randChoice(rng, [10, 20, 25, 30, 50]);
    const raw = ((1 - drop / 100) * (1 + rise / 100) - 1) * 100;
    if (!Number.isInteger(Math.round(raw))) {
      i--;
      continue;
    }
    const ans = Math.round(raw);
    const prompt = `A stock drops by $${drop}\\%$ and then rises by $${rise}\\%$. What is the net percent change?`;
    const solution = `The combined multiplier is $${1 - drop / 100} \\times ${1 + rise / 100} = ${(
      (1 - drop / 100) *
      (1 + rise / 100)
    ).toFixed(4)}$, so the net change is $${ans}\\%$.`;
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
        intDistractors(ans, rng, [0, drop, rise, -drop]),
        solution,
        complexity,
        ["percentage", "compound"],
        rng
      )
    );
  }

  for (let i = 0; i < 10; i++) {
    const D = randChoice(rng, [10, 20, 25, 30]);
    const T = randChoice(rng, [5, 8, 10]);
    const ans = randChoice(rng, [50, 80, 100, 120, 150, 200]);
    const F = parseFloat(
      (ans * (1 - D / 100) * (1 + T / 100)).toFixed(2)
    );
    const prompt = `After a $${D}\\%$ discount and then $${T}\\%$ sales tax, an item costs $${F}$ dollars. What was the original price?`;
    const solution = `Let $x$ be the original price. Then $x \\cdot ${1 - D / 100} \\cdot ${1 + T / 100} = ${F}$, so $x = ${F} \\div (${(1 - D / 100) * (1 + T / 100)}) = ${ans}$ dollars.`;
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
        intDistractors(ans, rng, [F, Math.floor(ans / 2), ans + T]),
        solution,
        complexity,
        ["percentage", "reverse"],
        rng
      )
    );
  }

  for (let i = 0; i < 10; i++) {
    const params = (() => {
      for (let attempt = 0; attempt < 50; attempt++) {
        const A = randInt(rng, 5, 50);
        const P = randInt(rng, 5, 30);
        const Q = randInt(rng, 40, 80);
        const R = randInt(rng, P + 1, Q - 1);
        const x = (A * (Q - R)) / (R - P);
        if (Number.isInteger(x) && x > 0) {
          return { A, P, Q, R, x };
        }
      }
      return { A: 20, P: 10, Q: 50, R: 40, x: 20 };
    })();
    const prompt = `How many liters of a $${params.P}\\%$ acid solution must be added to $${params.A}$ liters of a $${params.Q}\\%$ acid solution to obtain a $${params.R}\\%$ acid solution?`;
    const solution = `Set up the equation $0.${params.P}x + 0.${params.Q}(${params.A}) = 0.${params.R}(x+${params.A})$ and solve to get $x = ${params.x}$ liters.`;
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
        intDistractors(params.x, rng, [params.A, params.A + params.x, params.R - params.P]),
        solution,
        complexity,
        ["percentage", "mixture"],
        rng
      )
    );
  }

  for (let i = 0; i < 10; i++) {
    const r = randChoice(rng, [10, 20, 30, 40, 50]);
    const P = Math.round((1 - r / 100) ** 2 * 100);
    const prompt = `After two equal successive discounts, an item costs $${P}\\%$ of its original price. What is the percent of each discount?`;
    const solution = `If each discount is $r\\%$, then $(1-r/100)^2 = ${P / 100}$. Thus $1-r/100 = ${1 - r / 100}$ and $r = ${r}$.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${r}\\%$`,
        `${r}`,
        "integer",
        intDistractors(r, rng, [P, 100 - P, Math.floor(r / 2)]),
        solution,
        complexity,
        ["percentage", "successive"],
        rng
      )
    );
  }

  return out;
}

export function generate(rng: () => number): Record<Difficulty, Problem[]> {
  return { easy: easy(rng), medium: medium(rng), hard: hard(rng) };
}
