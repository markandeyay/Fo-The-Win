import {
  type Problem,
  type Difficulty,
  type AnswerType,
  randInt,
  randChoice,
  makeProblem,
  intDistractors,
  decimalDistractors,
} from "./ch6_common.js";

const topic = "ch6.conversion_factors";
const source = "6.3";

function easy(rng: () => number): Problem[] {
  const diff: Difficulty = "easy";
  const complexity = 0.9;
  const out: Problem[] = [];
  let idx = 1;

  const units = [
    { from: "feet", to: "inches", factor: 12, maxQ: 20 },
    { from: "yards", to: "feet", factor: 3, maxQ: 20 },
    { from: "miles", to: "feet", factor: 5280, maxQ: 5 },
    { from: "meters", to: "centimeters", factor: 100, maxQ: 20 },
    { from: "kilometers", to: "meters", factor: 1000, maxQ: 10 },
    { from: "grams", to: "milligrams", factor: 1000, maxQ: 10 },
    { from: "kilograms", to: "grams", factor: 1000, maxQ: 10 },
    { from: "liters", to: "milliliters", factor: 1000, maxQ: 10 },
    { from: "hours", to: "minutes", factor: 60, maxQ: 12 },
    { from: "minutes", to: "seconds", factor: 60, maxQ: 12 },
    { from: "days", to: "hours", factor: 24, maxQ: 10 },
  ];

  for (let i = 0; i < 50; i++) {
    const u = randChoice(rng, units);
    const Q = randInt(rng, 1, u.maxQ);
    const ans = Q * u.factor;
    const prompt = `How many ${u.to} are in $${Q}$ ${u.from}?`;
    const solution = `Multiply by the conversion factor $${u.factor}$: $${Q} \\times ${u.factor} = ${ans}$ ${u.to}.`;
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
        intDistractors(ans, rng, [Q + u.factor, Q * 10, Math.floor(ans / 2)]),
        solution,
        complexity,
        ["conversion", "units"],
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

  const conversions = [
    { from: "yards", to: "inches", factor: 36, maxQ: 15 },
    { from: "miles", to: "yards", factor: 1760, maxQ: 8 },
    { from: "miles", to: "inches", factor: 63360, maxQ: 3 },
    { from: "kilometers", to: "centimeters", factor: 100000, maxQ: 5 },
    { from: "kilometers", to: "millimeters", factor: 1000000, maxQ: 3 },
    { from: "kilograms", to: "milligrams", factor: 1000000, maxQ: 3 },
    { from: "liters", to: "cubic centimeters", factor: 1000, maxQ: 10 },
    { from: "days", to: "minutes", factor: 1440, maxQ: 5 },
    { from: "hours", to: "seconds", factor: 3600, maxQ: 5 },
    { from: "meters", to: "millimeters", factor: 1000, maxQ: 10 },
  ];

  for (let i = 0; i < 50; i++) {
    const u = randChoice(rng, conversions);
    const Q = randInt(rng, 1, u.maxQ);
    const ans = Q * u.factor;
    const prompt = `How many ${u.to} are in $${Q}$ ${u.from}?`;
    const solution = `Multiply by $${u.factor}$: $${Q} \\times ${u.factor} = ${ans}$ ${u.to}.`;
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
        intDistractors(ans, rng, [
          Math.floor(ans / 10),
          ans + u.factor,
          Q * Math.floor(Math.sqrt(u.factor)),
        ]),
        solution,
        complexity,
        ["conversion", "units"],
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

  const conversions = [
    {
      from: "kilometers per hour",
      to: "meters per second",
      factor: 5 / 18,
      qValues: [18, 36, 54, 72, 90],
    },
    {
      from: "meters per second",
      to: "kilometers per hour",
      factor: 18 / 5,
      qValues: [5, 10, 15, 20, 25],
    },
    {
      from: "grams per cubic centimeter",
      to: "kilograms per cubic meter",
      factor: 1000,
      qValues: [0.5, 1, 1.5, 2, 2.5],
    },
    {
      from: "kilograms per cubic meter",
      to: "grams per cubic centimeter",
      factor: 1 / 1000,
      qValues: [500, 1000, 1500, 2000],
    },
    {
      from: "square meters",
      to: "square centimeters",
      factor: 10000,
      qValues: [0.5, 1, 2, 3],
    },
    {
      from: "miles per hour",
      to: "feet per second",
      factor: 22 / 15,
      qValues: [15, 30, 45, 60],
    },
  ];

  for (let i = 0; i < 50; i++) {
    const u = randChoice(rng, conversions);
    const Q = randChoice(rng, u.qValues);
    const raw = Q * u.factor;
    const isInt = Math.abs(raw - Math.round(raw)) < 1e-9;
    const ans = isInt ? Math.round(raw) : parseFloat(raw.toFixed(2));
    const answerType: AnswerType = isInt ? "integer" : "decimal";
    const prompt = `Convert $${Q}$ ${u.from} to ${u.to}.`;
    const solution = `Multiply by the conversion factor $${(u.factor)
      .toFixed(6)
      .replace(/\.?0+$/, "")}$: $${Q} \\times ${u.factor} = ${ans}$ ${u.to}.`;
    out.push(
      makeProblem(
        idx++,
        topic,
        diff,
        source,
        prompt,
        `$${ans}$`,
        `${ans}`,
        answerType,
        answerType === "integer"
          ? intDistractors(ans as number, rng, [
              Math.floor((ans as number) / 10),
              (ans as number) + 10,
            ])
          : decimalDistractors(ans as number, rng),
        solution,
        complexity,
        ["conversion", "compound"],
        rng
      )
    );
  }

  return out;
}

export function generate(rng: () => number): Record<Difficulty, Problem[]> {
  return { easy: easy(rng), medium: medium(rng), hard: hard(rng) };
}
