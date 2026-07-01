import { describe, it, expect } from "vitest";
import {
  answersEquivalent,
  normalizeInteger,
  normalizeFraction,
  parseOrderedPair,
  parseSet,
} from "../../lib/normalizeAnswer";

describe("normalizeInteger", () => {
  it("parses integers with whitespace", () => {
    expect(normalizeInteger("  -42 ")).toBe(-42);
  });

  it("rejects decimals", () => {
    expect(normalizeInteger("3.5")).toBeNull();
  });
});

describe("normalizeFraction", () => {
  it("reduces fractions", () => {
    expect(normalizeFraction("  4/8 ")).toEqual({ num: 1, den: 2 });
  });

  it("handles negative signs", () => {
    expect(normalizeFraction("-3/6")).toEqual({ num: -1, den: 2 });
  });
});

describe("parseOrderedPair", () => {
  it("parses parentheses and bare forms", () => {
    expect(parseOrderedPair("(3, 4)")).toEqual([3, 4]);
    expect(parseOrderedPair("3,4")).toEqual([3, 4]);
  });
});

describe("parseSet", () => {
  it("parses and sorts set elements", () => {
    expect(parseSet("{b, a, c}")).toEqual(["a", "b", "c"]);
  });
});

describe("answersEquivalent", () => {
  it("matches integers", () => {
    expect(answersEquivalent(" 42 ", "42", "integer")).toBe(true);
    expect(answersEquivalent("42", "43", "integer")).toBe(false);
  });

  it("matches decimals within tolerance", () => {
    expect(answersEquivalent("3.14159", "3.141590001", "decimal")).toBe(true);
  });

  it("matches equivalent fractions", () => {
    expect(answersEquivalent("2/4", "1/2", "fraction")).toBe(true);
  });

  it("matches ordered pairs", () => {
    expect(answersEquivalent("(3,4)", "3, 4", "ordered_pair")).toBe(true);
  });

  it("matches sets regardless of order", () => {
    expect(answersEquivalent("{1, 2}", "{2, 1}", "set")).toBe(true);
  });

  it("matches expressions by exact or accepted form", () => {
    expect(answersEquivalent("(x-3)(x-4)", "(x-3)(x-4)", "expression")).toBe(true);
    expect(
      answersEquivalent("x^2 - 7x + 12", "(x-3)(x-4)", "expression")
    ).toBe(true);
  });

  it("uses accepted forms when symbolic compare is ambiguous", () => {
    expect(
      answersEquivalent("(x-4)(x-3)", "(x-3)(x-4)", "expression", [
        "(x-4)(x-3)",
      ])
    ).toBe(true);
  });
});
