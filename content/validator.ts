import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import katex from "katex";
import { answersEquivalent, normalizeAnswer, type AnswerType } from "../lib/normalizeAnswer";

interface Choice {
  id: string;
  latex: string;
}

interface Problem {
  id: string;
  topic_id: string;
  group_id: string;
  difficulty: "easy" | "medium" | "hard";
  prompt_latex: string;
  answer_format: "mc" | "numeric" | "exact";
  choices?: Choice[];
  correct_choice?: string;
  correct_answer: string;
  answer_type: AnswerType;
  accepted_forms?: string[];
  solution_latex: string;
  complexity_factor: number;
  source_section?: string;
  tags: string[];
  checksum: string;
  status: string;
}

const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const ANSWER_FORMATS = ["mc", "numeric", "exact"] as const;
const ANSWER_TYPES: AnswerType[] = [
  "integer",
  "fraction",
  "decimal",
  "expression",
  "ordered_pair",
  "set",
  "interval",
  "boolean",
  "string",
];

function computeChecksum(problem: Partial<Problem>): string {
  const payload =
    (problem.topic_id ?? "") +
    (problem.difficulty ?? "") +
    (problem.prompt_latex ?? "") +
    (problem.correct_answer ?? "");
  return "sha256-" + crypto.createHash("sha256").update(payload).digest("hex");
}

function extractMathSegments(source: string): string[] {
  const segments: string[] = [];
  const patterns = [
    /\$\$([\s\S]+?)\$\$/g,
    /\\\(([\s\S]+?)\\\)/g,
    /\\\[([\s\S]+?)\\\]/g,
    /\$([^$\n]+?)\$/g,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      segments.push(match[1].trim());
    }
  }
  return segments;
}

function compileLatex(source: string): boolean {
  const segments = extractMathSegments(source);
  if (segments.length === 0) {
    // Plain text with no math delimiters; nothing to compile.
    return true;
  }
  for (const latex of segments) {
    try {
      katex.renderToString(latex, { throwOnError: true, strict: "error" });
    } catch {
      return false;
    }
  }
  return true;
}

function unwrapMath(source: string): string {
  return source
    .trim()
    .replace(/^\$\$(.*)\$\$$/, "$1")
    .replace(/^\\\[(.*)\\\]$/, "$1")
    .replace(/^\\\((.*)\\\)$/, "$1")
    .replace(/^\$(.*)\$$/, "$1")
    .trim();
}

function validateAnswerValue(value: string, answerType: AnswerType): boolean {
  const normalized = normalizeAnswer(value, answerType);
  if (normalized === null) return false;
  if (answerType === "interval") {
    return /\(.*,.*\)/.test(value) || /\[.*,.*\]/.test(value);
  }
  return true;
}

function verifyAnswer(problem: Problem): { ok: boolean; reason?: string } {
  if (!validateAnswerValue(problem.correct_answer, problem.answer_type)) {
    return { ok: false, reason: "correct_answer is not a valid value for answer_type" };
  }

  if (problem.answer_type === "expression") {
    try {
      const normalized = normalizeAnswer(problem.correct_answer, "expression");
      if (typeof normalized !== "string" || normalized.length === 0) {
        return { ok: false, reason: "correct_answer expression is empty" };
      }
    } catch {
      return { ok: false, reason: "correct_answer expression does not parse" };
    }
  }

  if (
    ["integer", "decimal", "fraction", "ordered_pair", "set", "boolean", "string"].includes(
      problem.answer_type
    )
  ) {
    if (normalizeAnswer(problem.correct_answer, problem.answer_type) === null) {
      return { ok: false, reason: "correct_answer failed type-specific parsing" };
    }
  }

  return { ok: true };
}

function validateProblem(
  problem: Problem,
  checksums: Set<string>
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Schema checks
  const requiredFields = [
    "id",
    "topic_id",
    "group_id",
    "difficulty",
    "prompt_latex",
    "answer_format",
    "correct_answer",
    "answer_type",
    "solution_latex",
    "complexity_factor",
    "tags",
    "checksum",
    "status",
  ];
  for (const field of requiredFields) {
    if (!(field in problem)) {
      reasons.push(`missing required field: ${field}`);
    }
  }

  if (!DIFFICULTIES.includes(problem.difficulty)) {
    reasons.push(`invalid difficulty: ${problem.difficulty}`);
  }
  if (!ANSWER_FORMATS.includes(problem.answer_format)) {
    reasons.push(`invalid answer_format: ${problem.answer_format}`);
  }
  if (!ANSWER_TYPES.includes(problem.answer_type)) {
    reasons.push(`invalid answer_type: ${problem.answer_type}`);
  }

  // Multiple choice checks
  if (problem.answer_format === "mc") {
    if (!problem.choices || problem.choices.length !== 4) {
      reasons.push("mc format requires exactly 4 choices");
    } else {
      const ids = problem.choices.map((c) => c.id);
      if (!ids.includes(problem.correct_choice ?? "")) {
        reasons.push("correct_choice not found in choices");
      }
      const uniqueIds = new Set(ids);
      if (uniqueIds.size !== ids.length) {
        reasons.push("duplicate choice ids");
      }
    }
  }

  // KaTeX compile checks
  if (!compileLatex(problem.prompt_latex)) {
    reasons.push("prompt_latex failed KaTeX compile");
  }
  if (!compileLatex(problem.solution_latex)) {
    reasons.push("solution_latex failed KaTeX compile");
  }
  if (problem.choices) {
    for (const choice of problem.choices) {
      if (!compileLatex(choice.latex)) {
        reasons.push(`choice ${choice.id} failed KaTeX compile`);
      }
    }
  }

  // Complexity factor
  if (
    typeof problem.complexity_factor !== "number" ||
    problem.complexity_factor < 0.6 ||
    problem.complexity_factor > 1.6
  ) {
    reasons.push(`complexity_factor out of range: ${problem.complexity_factor}`);
  }

  // Checksum
  const expectedChecksum = computeChecksum(problem);
  if (problem.checksum !== expectedChecksum) {
    reasons.push("checksum mismatch");
  }
  if (checksums.has(problem.checksum)) {
    reasons.push("duplicate checksum");
  }

  // Independent answer verification
  const verification = verifyAnswer(problem);
  if (!verification.ok) {
    reasons.push(verification.reason ?? "answer verification failed");
  }

  // Distractor checks
  if (problem.answer_format === "mc" && problem.choices) {
    const seen = new Set<string>();
    const correctNormalized = normalizeAnswer(problem.correct_answer, problem.answer_type);
    for (const choice of problem.choices) {
      if (choice.id === problem.correct_choice) continue;

      const unwrapped = unwrapMath(choice.latex);
      const normalized = normalizeAnswer(unwrapped, problem.answer_type);
      if (normalized === null) {
        reasons.push(`distractor ${choice.id} is not a valid ${problem.answer_type}`);
        continue;
      }
      const key = typeof normalized === "string" ? normalized : JSON.stringify(normalized);
      if (seen.has(key)) {
        reasons.push(`duplicate distractor or duplicate of correct answer: ${choice.id}`);
      }
      seen.add(key);

      if (
        correctNormalized !== null &&
        answersEquivalent(unwrapped, problem.correct_answer, problem.answer_type)
      ) {
        reasons.push(`distractor ${choice.id} matches correct answer`);
      }
    }
  }

  return { ok: reasons.length === 0, reasons };
}

async function main() {
  const problemsDir = path.join(process.cwd(), "content", "problems");
  const reportsDir = path.join(process.cwd(), "content", "reports");
  fs.mkdirSync(reportsDir, { recursive: true });

  const report: {
    total: number;
    passed: number;
    failed: number;
    byTopic: Record<string, { passed: number; failed: number }>;
    rejected: { id?: string; file: string; reasons: string[] }[];
  } = {
    total: 0,
    passed: 0,
    failed: 0,
    byTopic: {},
    rejected: [],
  };

  const checksums = new Set<string>();

  function collectJsonFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...collectJsonFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        files.push(fullPath);
      }
    }
    return files;
  }

  if (!fs.existsSync(problemsDir)) {
    fs.mkdirSync(problemsDir, { recursive: true });
  }

  const files = collectJsonFiles(problemsDir);

  for (const file of files) {
    let problems: Problem[];
    try {
      problems = JSON.parse(fs.readFileSync(file, "utf-8"));
      if (!Array.isArray(problems)) {
        problems = [problems];
      }
    } catch (err) {
      report.total += 1;
      report.failed += 1;
      report.rejected.push({ file, reasons: ["invalid JSON"] });
      continue;
    }

    for (const problem of problems) {
      report.total += 1;
      const result = validateProblem(problem, checksums);
      const topic = problem.topic_id ?? "unknown";
      report.byTopic[topic] = report.byTopic[topic] ?? { passed: 0, failed: 0 };

      if (result.ok) {
        report.passed += 1;
        report.byTopic[topic].passed += 1;
        checksums.add(problem.checksum);
      } else {
        report.failed += 1;
        report.byTopic[topic].failed += 1;
        report.rejected.push({
          id: problem.id,
          file: path.relative(process.cwd(), file),
          reasons: result.reasons,
        });
      }
    }
  }

  const reportPath = path.join(reportsDir, "validation.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`Validation: ${report.passed}/${report.total} passed`);
  if (report.failed > 0) {
    console.log(`${report.failed} rejected; see ${reportPath}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
