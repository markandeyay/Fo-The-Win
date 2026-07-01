import { create, all } from "mathjs";

const math = create(all, {});

export type AnswerType =
  | "integer"
  | "fraction"
  | "decimal"
  | "expression"
  | "ordered_pair"
  | "set"
  | "interval"
  | "boolean"
  | "string";

export function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function parseNumber(input: string): number | null {
  const cleaned = input.replace(/\s+/g, "").replace(/,/g, "");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function normalizeInteger(input: string): number | null {
  const value = parseNumber(input);
  if (value === null) return null;
  if (!Number.isInteger(value)) return null;
  return value;
}

export function normalizeDecimal(input: string): number | null {
  return parseNumber(input);
}

export interface Fraction {
  num: number;
  den: number;
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

export function normalizeFraction(input: string): Fraction | null {
  const cleaned = input
    .replace(/\s+/g, "")
    .replace(/^\\(?:dfrac|frac)\{([^}]+)\}\{([^}]+)\}$/, "$1/$2");
  const match = cleaned.match(/^(-?\d+)\/(\d+)$/);
  if (!match) return null;
  let num = parseInt(match[1], 10);
  let den = parseInt(match[2], 10);
  if (den === 0) return null;
  if (den < 0) {
    num = -num;
    den = -den;
  }
  const g = gcd(num, den);
  return { num: num / g, den: den / g };
}

export function fractionToString(f: Fraction): string {
  return `${f.num}/${f.den}`;
}

function stripOuterParens(input: string): string {
  let s = input.trim();
  while (s.startsWith("(") && s.endsWith(")")) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

export function parseOrderedPair(input: string): [number, number] | null {
  const s = stripOuterParens(input).replace(/\s+/g, "");
  const match = s.match(/^\(?(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)?$/);
  if (!match) return null;
  return [parseFloat(match[1]), parseFloat(match[2])];
}

export function parseSet(input: string): string[] | null {
  const s = input.trim();
  if (!s.startsWith("{") || !s.endsWith("}")) return null;
  const inner = s.slice(1, -1).trim();
  if (inner === "") return [];
  return inner
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
    .sort();
}

export function normalizeExpression(input: string): string {
  return input.replace(/\s+/g, "").toLowerCase();
}

function insertExplicitMultiplication(expr: string): string {
  // Insert * between adjacent closing and opening parentheses, e.g. (a)(b) -> (a)*(b)
  return expr
    .replace(/\)\(/g, ")*(")
    .replace(/(\d)(\()/g, "$1*$2")
    .replace(/(\))(\w)/g, "$1*$2");
}

function trySymbolicEquality(given: string, expected: string): boolean | null {
  try {
    const preparedGiven = insertExplicitMultiplication(given);
    const preparedExpected = insertExplicitMultiplication(expected);
    const givenNode = math.parse(preparedGiven);
    const expectedNode = math.parse(preparedExpected);
    const diff = math.simplify(
      new math.OperatorNode("-", "subtract", [givenNode, expectedNode])
    );
    if (diff.toString() === "0") return true;

    for (let i = 0; i < 5; i++) {
      const scope: Record<string, number> = {};
      const letters = "xyzabc".split("");
      for (const letter of letters) {
        scope[letter] = (i + 1) * 1.3 + Math.random() * 2;
      }
      const d = diff.evaluate(scope);
      if (typeof d === "number" && Math.abs(d) > 1e-6) {
        return false;
      }
    }
    return true;
  } catch {
    return null;
  }
}

export function answersEquivalent(
  given: string,
  expected: string,
  answerType: AnswerType,
  acceptedForms?: string[]
): boolean {
  const normalizedGiven = normalizeWhitespace(given);
  const normalizedExpected = normalizeWhitespace(expected);

  switch (answerType) {
    case "integer": {
      const a = normalizeInteger(normalizedGiven);
      const b = normalizeInteger(normalizedExpected);
      return a !== null && b !== null && a === b;
    }
    case "decimal": {
      const a = normalizeDecimal(normalizedGiven);
      const b = normalizeDecimal(normalizedExpected);
      return (
        a !== null && b !== null && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b))
      );
    }
    case "fraction": {
      const a = normalizeFraction(normalizedGiven);
      const b = normalizeFraction(normalizedExpected);
      if (a === null || b === null) return false;
      return a.num === b.num && a.den === b.den;
    }
    case "ordered_pair": {
      const a = parseOrderedPair(normalizedGiven);
      const b = parseOrderedPair(normalizedExpected);
      if (a === null || b === null) return false;
      return (
        Math.abs(a[0] - b[0]) <= 1e-9 && Math.abs(a[1] - b[1]) <= 1e-9
      );
    }
    case "set": {
      const a = parseSet(normalizedGiven);
      const b = parseSet(normalizedExpected);
      if (a === null || b === null) return false;
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
      }
      return true;
    }
    case "boolean": {
      const a = normalizedGiven.toLowerCase();
      const b = normalizedExpected.toLowerCase();
      return a === b;
    }
    case "string": {
      return normalizedGiven.toLowerCase() === normalizedExpected.toLowerCase();
    }
    case "expression":
    default: {
      const forms = [normalizedExpected, ...(acceptedForms ?? [])];
      const exactMatch = forms.some(
        (form) => normalizeExpression(normalizedGiven) === normalizeExpression(form)
      );
      if (exactMatch) return true;

      const symbolic = trySymbolicEquality(normalizedGiven, normalizedExpected);
      if (symbolic !== null) return symbolic;

      return forms.some(
        (form) =>
          normalizeExpression(normalizedGiven) === normalizeExpression(form)
      );
    }
  }
}

export function normalizeAnswer(
  input: string,
  answerType: AnswerType
): string | number | Fraction | [number, number] | string[] | null {
  const s = normalizeWhitespace(input);
  switch (answerType) {
    case "integer":
      return normalizeInteger(s);
    case "decimal":
      return normalizeDecimal(s);
    case "fraction": {
      const f = normalizeFraction(s);
      return f ? fractionToString(f) : null;
    }
    case "ordered_pair": {
      const p = parseOrderedPair(s);
      return p ?? null;
    }
    case "set":
      return parseSet(s);
    case "boolean":
    case "string":
    case "expression":
    default:
      return normalizeExpression(s);
  }
}
