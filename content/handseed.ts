import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

interface Choice {
  id: string;
  latex: string;
}

type Difficulty = "easy" | "medium" | "hard";

interface ProblemTemplate {
  topic_id: string;
  group_id: string;
  difficulty: Difficulty;
  prompt_latex: string;
  answer_format: "mc" | "numeric" | "exact";
  choices: Choice[];
  correct_choice: string;
  correct_answer: string;
  answer_type:
    | "integer"
    | "fraction"
    | "decimal"
    | "expression"
    | "ordered_pair"
    | "set"
    | "interval"
    | "boolean"
    | "string";
  accepted_forms?: string[];
  solution_latex: string;
  complexity_factor: number;
  source_section: string;
  tags: string[];
}

function computeChecksum(problem: Partial<ProblemTemplate>): string {
  const payload =
    (problem.topic_id ?? "") +
    (problem.difficulty ?? "") +
    (problem.prompt_latex ?? "") +
    (problem.correct_answer ?? "");
  return "sha256-" + crypto.createHash("sha256").update(payload).digest("hex");
}

function makeId(template: ProblemTemplate, index: number): string {
  return `${template.topic_id}.${template.difficulty}.${String(index).padStart(4, "0")}`;
}

const templates: ProblemTemplate[] = [
  {
    topic_id: "ch1.order_of_ops",
    group_id: "ch1_rules",
    difficulty: "easy",
    prompt_latex: "Evaluate $3 + 4 \\cdot 2$.",
    answer_format: "mc",
    choices: [
      { id: "a", latex: "$11$" },
      { id: "b", latex: "$14$" },
      { id: "c", latex: "$10$" },
      { id: "d", latex: "$7$" },
    ],
    correct_choice: "a",
    correct_answer: "11",
    answer_type: "integer",
    solution_latex: "Multiply first: $4 \\cdot 2 = 8$. Then $3 + 8 = 11$.",
    complexity_factor: 0.8,
    source_section: "1.2",
    tags: ["order_of_operations"],
  },
  {
    topic_id: "ch1.order_of_ops",
    group_id: "ch1_rules",
    difficulty: "easy",
    prompt_latex: "Evaluate $12 - 4 \\div 2$.",
    answer_format: "mc",
    choices: [
      { id: "a", latex: "$10$" },
      { id: "b", latex: "$4$" },
      { id: "c", latex: "$14$" },
      { id: "d", latex: "$6$" },
    ],
    correct_choice: "a",
    correct_answer: "10",
    answer_type: "integer",
    solution_latex: "Divide first: $4 \\div 2 = 2$. Then $12 - 2 = 10$.",
    complexity_factor: 0.8,
    source_section: "1.2",
    tags: ["order_of_operations"],
  },
  {
    topic_id: "ch1.order_of_ops",
    group_id: "ch1_rules",
    difficulty: "easy",
    prompt_latex: "Evaluate $(5 + 3) \\cdot 2$.",
    answer_format: "mc",
    choices: [
      { id: "a", latex: "$16$" },
      { id: "b", latex: "$13$" },
      { id: "c", latex: "$11$" },
      { id: "d", latex: "$24$" },
    ],
    correct_choice: "a",
    correct_answer: "16",
    answer_type: "integer",
    solution_latex: "Parentheses first: $5 + 3 = 8$. Then $8 \\cdot 2 = 16$.",
    complexity_factor: 0.8,
    source_section: "1.2",
    tags: ["order_of_operations"],
  },
  {
    topic_id: "ch1.order_of_ops",
    group_id: "ch1_rules",
    difficulty: "medium",
    prompt_latex: "Evaluate $20 - 3(4 + 2)$.",
    answer_format: "mc",
    choices: [
      { id: "a", latex: "$2$" },
      { id: "b", latex: "$90$" },
      { id: "c", latex: "$14$" },
      { id: "d", latex: "$102$" },
    ],
    correct_choice: "a",
    correct_answer: "2",
    answer_type: "integer",
    solution_latex: "Inside the parentheses: $4 + 2 = 6$. Multiply: $3 \\cdot 6 = 18$. Subtract: $20 - 18 = 2$.",
    complexity_factor: 0.9,
    source_section: "1.2",
    tags: ["order_of_operations"],
  },
  {
    topic_id: "ch1.order_of_ops",
    group_id: "ch1_rules",
    difficulty: "medium",
    prompt_latex: "Evaluate $(1 + 2)^3 - 4 \\cdot 5$.",
    answer_format: "mc",
    choices: [
      { id: "a", latex: "$7$" },
      { id: "b", latex: "$3$" },
      { id: "c", latex: "$135$" },
      { id: "d", latex: "$-1$" },
    ],
    correct_choice: "a",
    correct_answer: "7",
    answer_type: "integer",
    solution_latex: "$(1+2)^3 = 3^3 = 27$ and $4 \\cdot 5 = 20$, so $27 - 20 = 7$.",
    complexity_factor: 0.9,
    source_section: "1.2",
    tags: ["order_of_operations"],
  },
  {
    topic_id: "ch1.order_of_ops",
    group_id: "ch1_rules",
    difficulty: "hard",
    prompt_latex: "Evaluate $2^3 + 3 \\cdot \\left( \\dfrac{12}{2^2 - 1} \\right)$.",
    answer_format: "mc",
    choices: [
      { id: "a", latex: "$20$" },
      { id: "b", latex: "$12$" },
      { id: "c", latex: "$14$" },
      { id: "d", latex: "$44$" },
    ],
    correct_choice: "a",
    correct_answer: "20",
    answer_type: "integer",
    solution_latex: "$2^2 - 1 = 3$, so $12/3 = 4$. Then $2^3 + 3 \\cdot 4 = 8 + 12 = 20$.",
    complexity_factor: 1.1,
    source_section: "1.2",
    tags: ["order_of_operations"],
  },
  {
    topic_id: "ch1.order_of_ops",
    group_id: "ch1_rules",
    difficulty: "hard",
    prompt_latex: "Evaluate $(5 - 2)^3 \\div 3^2 + 6$.",
    answer_format: "mc",
    choices: [
      { id: "a", latex: "$9$" },
      { id: "b", latex: "$33$" },
      { id: "c", latex: "$15$" },
      { id: "d", latex: "$3$" },
    ],
    correct_choice: "a",
    correct_answer: "9",
    answer_type: "integer",
    solution_latex: "$(5-2)^3 = 27$ and $3^2 = 9$, so $27 \\div 9 + 6 = 3 + 6 = 9$.",
    complexity_factor: 1.1,
    source_section: "1.2",
    tags: ["order_of_operations"],
  },
  {
    topic_id: "ch3.solving_linear_1",
    group_id: "ch3_one_var_linear",
    difficulty: "easy",
    prompt_latex: "Solve $2x + 5 = 13$.",
    answer_format: "mc",
    choices: [
      { id: "a", latex: "$4$" },
      { id: "b", latex: "$9$" },
      { id: "c", latex: "$-4$" },
      { id: "d", latex: "$1$" },
    ],
    correct_choice: "a",
    correct_answer: "4",
    answer_type: "integer",
    solution_latex: "Subtract 5: $2x = 8$. Divide by 2: $x = 4$.",
    complexity_factor: 0.9,
    source_section: "3.1",
    tags: ["linear_equations"],
  },
  {
    topic_id: "ch3.solving_linear_1",
    group_id: "ch3_one_var_linear",
    difficulty: "easy",
    prompt_latex: "Solve $3x - 7 = 8$.",
    answer_format: "mc",
    choices: [
      { id: "a", latex: "$5$" },
      { id: "b", latex: "$1$" },
      { id: "c", latex: "$-5$" },
      { id: "d", latex: "$15$" },
    ],
    correct_choice: "a",
    correct_answer: "5",
    answer_type: "integer",
    solution_latex: "Add 7: $3x = 15$. Divide by 3: $x = 5$.",
    complexity_factor: 0.9,
    source_section: "3.1",
    tags: ["linear_equations"],
  },
  {
    topic_id: "ch3.solving_linear_1",
    group_id: "ch3_one_var_linear",
    difficulty: "easy",
    prompt_latex: "Solve $5(x + 2) = 25$.",
    answer_format: "mc",
    choices: [
      { id: "a", latex: "$3$" },
      { id: "b", latex: "$7$" },
      { id: "c", latex: "$5$" },
      { id: "d", latex: "$-3$" },
    ],
    correct_choice: "a",
    correct_answer: "3",
    answer_type: "integer",
    solution_latex: "Divide by 5: $x + 2 = 5$. Subtract 2: $x = 3$.",
    complexity_factor: 0.9,
    source_section: "3.1",
    tags: ["linear_equations"],
  },
  {
    topic_id: "ch3.solving_linear_1",
    group_id: "ch3_one_var_linear",
    difficulty: "medium",
    prompt_latex: "Solve $4x - 9 = 2x + 7$.",
    answer_format: "mc",
    choices: [
      { id: "a", latex: "$8$" },
      { id: "b", latex: "$1$" },
      { id: "c", latex: "$-1$" },
      { id: "d", latex: "$4$" },
    ],
    correct_choice: "a",
    correct_answer: "8",
    answer_type: "integer",
    solution_latex: "Subtract $2x$: $2x - 9 = 7$. Add 9: $2x = 16$. Divide by 2: $x = 8$.",
    complexity_factor: 1.0,
    source_section: "3.1",
    tags: ["linear_equations"],
  },
  {
    topic_id: "ch3.solving_linear_1",
    group_id: "ch3_one_var_linear",
    difficulty: "medium",
    prompt_latex: "Solve $\\dfrac{x}{3} + 4 = 9$.",
    answer_format: "mc",
    choices: [
      { id: "a", latex: "$15$" },
      { id: "b", latex: "$45$" },
      { id: "c", latex: "$1$" },
      { id: "d", latex: "$39$" },
    ],
    correct_choice: "a",
    correct_answer: "15",
    answer_type: "integer",
    solution_latex: "Subtract 4: $x/3 = 5$. Multiply by 3: $x = 15$.",
    complexity_factor: 1.0,
    source_section: "3.1",
    tags: ["linear_equations"],
  },
  {
    topic_id: "ch10.factoring_1",
    group_id: "ch10_quadratics_1",
    difficulty: "easy",
    prompt_latex: "Factor completely: $x^2 + 5x + 6$.",
    answer_format: "mc",
    choices: [
      { id: "a", latex: "$(x + 2)(x + 3)$" },
      { id: "b", latex: "$(x + 1)(x + 6)$" },
      { id: "c", latex: "$(x + 2)(x + 4)$" },
      { id: "d", latex: "$(x + 6)(x - 1)$" },
    ],
    correct_choice: "a",
    correct_answer: "(x+2)(x+3)",
    answer_type: "expression",
    accepted_forms: ["(x+3)(x+2)"],
    solution_latex: "We need two numbers with product 6 and sum 5: 2 and 3.",
    complexity_factor: 0.9,
    source_section: "10.2",
    tags: ["factoring", "quadratic"],
  },
  {
    topic_id: "ch10.factoring_1",
    group_id: "ch10_quadratics_1",
    difficulty: "easy",
    prompt_latex: "Factor completely: $x^2 - 9$.",
    answer_format: "mc",
    choices: [
      { id: "a", latex: "$(x - 3)(x + 3)$" },
      { id: "b", latex: "$(x - 3)^2$" },
      { id: "c", latex: "$(x + 9)(x - 1)$" },
      { id: "d", latex: "$(x - 9)(x + 1)$" },
    ],
    correct_choice: "a",
    correct_answer: "(x-3)(x+3)",
    answer_type: "expression",
    accepted_forms: ["(x+3)(x-3)"],
    solution_latex: "Difference of squares: $x^2 - 9 = (x - 3)(x + 3)$.",
    complexity_factor: 0.9,
    source_section: "10.2",
    tags: ["factoring", "quadratic"],
  },
  {
    topic_id: "ch10.factoring_1",
    group_id: "ch10_quadratics_1",
    difficulty: "medium",
    prompt_latex: "Factor completely: $x^2 - x - 12$.",
    answer_format: "mc",
    choices: [
      { id: "a", latex: "$(x - 4)(x + 3)$" },
      { id: "b", latex: "$(x - 3)(x + 4)$" },
      { id: "c", latex: "$(x - 6)(x + 2)$" },
      { id: "d", latex: "$(x - 2)(x + 6)$" },
    ],
    correct_choice: "a",
    correct_answer: "(x-4)(x+3)",
    answer_type: "expression",
    accepted_forms: ["(x+3)(x-4)"],
    solution_latex: "We need two numbers with product $-12$ and sum $-1$: $-4$ and $3$.",
    complexity_factor: 1.0,
    source_section: "10.2",
    tags: ["factoring", "quadratic"],
  },
  {
    topic_id: "ch10.factoring_1",
    group_id: "ch10_quadratics_1",
    difficulty: "hard",
    prompt_latex: "Find the sum of all integer values of $k$ for which $x^2 + kx + 12$ factors over the integers.",
    answer_format: "mc",
    choices: [
      { id: "a", latex: "$0$" },
      { id: "b", latex: "$28$" },
      { id: "c", latex: "$-28$" },
      { id: "d", latex: "$14$" },
    ],
    correct_choice: "a",
    correct_answer: "0",
    answer_type: "integer",
    solution_latex: "Factor pairs of 12 give $k \\in \\{13, 8, 7, -7, -8, -13\\}$, whose sum is 0.",
    complexity_factor: 1.3,
    source_section: "10.2",
    tags: ["factoring", "quadratic", "casework"],
  },
  {
    topic_id: "ch21.telescoping",
    group_id: "ch21_sequences_series",
    difficulty: "medium",
    prompt_latex: "Evaluate $\\displaystyle \\sum_{n=1}^{10} \\frac{1}{n(n+1)}$.",
    answer_format: "mc",
    choices: [
      { id: "a", latex: "$\\dfrac{10}{11}$" },
      { id: "b", latex: "$\\dfrac{1}{10}$" },
      { id: "c", latex: "$\\dfrac{1}{11}$" },
      { id: "d", latex: "$\\dfrac{9}{10}$" },
    ],
    correct_choice: "a",
    correct_answer: "10/11",
    answer_type: "fraction",
    solution_latex: "$\\frac{1}{n(n+1)} = \\frac{1}{n} - \\frac{1}{n+1}$. The sum telescopes to $1 - \\frac{1}{11} = \\frac{10}{11}$.",
    complexity_factor: 1.3,
    source_section: "21.5",
    tags: ["telescoping", "series"],
  },
  {
    topic_id: "ch21.telescoping",
    group_id: "ch21_sequences_series",
    difficulty: "medium",
    prompt_latex: "Evaluate $\\displaystyle \\sum_{n=1}^{5} \\left( \\frac{1}{n} - \\frac{1}{n+1} \\right)$.",
    answer_format: "mc",
    choices: [
      { id: "a", latex: "$\\dfrac{5}{6}$" },
      { id: "b", latex: "$\\dfrac{1}{5}$" },
      { id: "c", latex: "$\\dfrac{1}{6}$" },
      { id: "d", latex: "$\\dfrac{4}{5}$" },
    ],
    correct_choice: "a",
    correct_answer: "5/6",
    answer_type: "fraction",
    solution_latex: "The series telescopes: $1 - \\frac{1}{6} = \\frac{5}{6}$.",
    complexity_factor: 1.2,
    source_section: "21.5",
    tags: ["telescoping", "series"],
  },
  {
    topic_id: "ch21.telescoping",
    group_id: "ch21_sequences_series",
    difficulty: "hard",
    prompt_latex: "Evaluate $\\displaystyle \\sum_{n=1}^{20} \\frac{1}{n(n+2)}$.",
    answer_format: "mc",
    choices: [
      { id: "a", latex: "$\\dfrac{607}{924}$" },
      { id: "b", latex: "$\\dfrac{19}{22}$" },
      { id: "c", latex: "$\\dfrac{10}{11}$" },
      { id: "d", latex: "$\\dfrac{607}{462}$" },
    ],
    correct_choice: "a",
    correct_answer: "607/924",
    answer_type: "fraction",
    solution_latex: "$\\frac{1}{n(n+2)} = \\frac{1}{2}\\left(\\frac{1}{n} - \\frac{1}{n+2}\\right)$. Telescoping leaves $\\frac{1}{2}\\left(1 + \\frac{1}{2} - \\frac{1}{21} - \\frac{1}{22}\\right) = \\frac{607}{924}$.",
    complexity_factor: 1.5,
    source_section: "21.5",
    tags: ["telescoping", "series", "partial_fractions"],
  },
  {
    topic_id: "ch1.exponents",
    group_id: "ch1_rules",
    difficulty: "easy",
    prompt_latex: "Evaluate $2^3 \\cdot 2^2$.",
    answer_format: "mc",
    choices: [
      { id: "a", latex: "$32$" },
      { id: "b", latex: "$64$" },
      { id: "c", latex: "$10$" },
      { id: "d", latex: "$24$" },
    ],
    correct_choice: "a",
    correct_answer: "32",
    answer_type: "integer",
    solution_latex: "$2^3 \\cdot 2^2 = 2^{3+2} = 2^5 = 32$.",
    complexity_factor: 0.8,
    source_section: "1.6",
    tags: ["exponents"],
  },
];

const problemsDir = path.join(process.cwd(), "content", "problems");

const byFile: Record<string, ProblemTemplate[]> = {};
for (const template of templates) {
  const dir = path.join(problemsDir, template.group_id);
  fs.mkdirSync(dir, { recursive: true });
  const fileName = `${template.topic_id}.${template.difficulty}.json`;
  const filePath = path.join(dir, fileName);
  byFile[filePath] = byFile[filePath] ?? [];
  byFile[filePath].push(template);
}

let counter = 0;
for (const [filePath, items] of Object.entries(byFile)) {
  const problems = items.map((template, index) => {
    counter += 1;
    const problem: any = { ...template };
    problem.id = makeId(template, index + 1);
    problem.checksum = computeChecksum(problem);
    problem.status = "valid";
    return problem;
  });
  fs.writeFileSync(filePath, JSON.stringify(problems, null, 2));
  console.log(`wrote ${problems.length} problems to ${filePath}`);
}

console.log(`hand-seeded ${counter} problems`);
