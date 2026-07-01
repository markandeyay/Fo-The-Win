import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

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

const groupId = "ch12_complex";
const outDir = path.join(process.cwd(), "content", "problems", groupId);

function checksum(problem: Pick<Problem, "topic_id" | "difficulty" | "prompt_latex" | "correct_answer">): string {
  return "sha256-" + crypto.createHash("sha256").update(problem.topic_id + problem.difficulty + problem.prompt_latex + problem.correct_answer).digest("hex");
}

function plainChoices(values: string[], correct: string, index: number): { choices: Choice[]; correct_choice: string } {
  const ids = ["a", "b", "c", "d"];
  const correctSlot = index % 4;
  const ordered = [...new Set(values)].filter((value) => value !== correct).slice(0, 3);
  for (const fallback of ["natural", "integer", "rational", "irrational", "real", "complex"]) {
    if (ordered.length === 3) break;
    if (fallback !== correct && !ordered.includes(fallback)) ordered.push(fallback);
  }
  ordered.splice(correctSlot, 0, correct);
  return {
    choices: ordered.map((value, i) => ({ id: ids[i], latex: value })),
    correct_choice: ids[correctSlot],
  };
}

function mathChoices(values: string[], correct: string, index: number): { choices: Choice[]; correct_choice: string } {
  const ids = ["a", "b", "c", "d"];
  const correctSlot = index % 4;
  const ordered = [...new Set(values)].filter((value) => value !== correct).slice(0, 3);
  const needsImaginary = values.some((value) => value.includes("i"));
  for (let n = 0; ordered.length < 3; n++) {
    const fallback = needsImaginary ? fmtComplex(100 + index + n, n + 1) : String(100 + index + n);
    if (fallback !== correct && !ordered.includes(fallback)) ordered.push(fallback);
  }
  ordered.splice(correctSlot, 0, correct);
  return {
    choices: ordered.map((value, i) => ({ id: ids[i], latex: `$${value}$` })),
    correct_choice: ids[correctSlot],
  };
}

function makeProblem(params: Omit<Problem, "id" | "group_id" | "answer_format" | "choices" | "correct_choice" | "checksum" | "status"> & { choiceValues: string[]; choiceStyle: "plain" | "math"; index: number }): Problem {
  const chooser = params.choiceStyle === "plain" ? plainChoices : mathChoices;
  const { choices, correct_choice } = chooser(params.choiceValues, params.correct_answer, params.index);
  const base = {
    id: `${params.topic_id}.${params.difficulty}.${String(params.index + 1).padStart(4, "0")}`,
    topic_id: params.topic_id,
    group_id: groupId,
    difficulty: params.difficulty,
    prompt_latex: params.prompt_latex,
    answer_format: "mc" as const,
    choices,
    correct_choice,
    correct_answer: params.correct_answer,
    answer_type: params.answer_type,
    accepted_forms: params.accepted_forms,
    solution_latex: params.solution_latex,
    complexity_factor: params.complexity_factor,
    source_section: params.source_section,
    tags: params.tags,
    status: "valid" as const,
  };
  return { ...base, checksum: checksum(base) };
}

function fmtComplex(real: number, imag: number): string {
  if (imag === 0) return String(real);
  if (real === 0) return fmtImag(imag);
  return `${real}${imag > 0 ? "+" : ""}${fmtImag(imag)}`;
}

function fmtImag(imag: number): string {
  if (imag === 1) return "i";
  if (imag === -1) return "-i";
  return `${imag}i`;
}

function acceptedComplex(real: number, imag: number): string[] {
  const primary = fmtComplex(real, imag);
  const spaced = primary.replace(/\+/g, " + ").replace(/-(?=\d|i)/g, " - ").replace(/^\s+/, "").trim();
  const forms = new Set<string>([spaced]);
  if (real !== 0 && imag !== 0) {
    forms.add(`${fmtImag(imag)}${real > 0 ? "+" : ""}${real}`);
  }
  return [...forms].filter((form) => form !== primary);
}

function iPower(n: number): string {
  const values = ["1", "i", "-1", "-i"];
  return values[((n % 4) + 4) % 4];
}

function generateMoreNumbers(difficulty: Difficulty): Problem[] {
  const topicId = "ch12.more_numbers";
  const source = "12.1";
  const problems: Problem[] = [];
  const commonTags = ["number-sets", "classification"];

  if (difficulty === "easy") {
    for (let i = 0; problems.length < 50; i++) {
      const kind = i % 10;
      const n = i + 2;
      const squareBase = i + 3;
      const item = kind === 0 ? { tex: `${n}`, answer: "natural", why: `$${n}$ is a positive counting number.` }
        : kind === 1 ? { tex: `-${n}`, answer: "integer", why: `$-${n}$ is an integer, but not natural.` }
        : kind === 2 ? { tex: `${n}-${n}`, answer: "integer", why: `$${n}-${n}=0$, which is an integer in the listed choices.` }
        : kind === 3 ? { tex: `\\frac{${n}}{${n + 2}}`, answer: "rational", why: `$\\frac{${n}}{${n + 2}}$ is a ratio of integers.` }
        : kind === 4 ? { tex: `-\\frac{${n + 3}}{${n + 1}}`, answer: "rational", why: `$-\\frac{${n + 3}}{${n + 1}}$ is a ratio of integers.` }
        : kind === 5 ? { tex: `\\sqrt{${squareBase * squareBase + 1}}`, answer: "irrational", why: `$${squareBase * squareBase + 1}$ is not a perfect square, so its square root is irrational.` }
        : kind === 6 ? { tex: `\\sqrt{${squareBase * squareBase}}`, answer: "natural", why: `$\\sqrt{${squareBase * squareBase}}=${squareBase}$, a positive counting number.` }
        : kind === 7 ? { tex: `-\\sqrt{${squareBase * squareBase}}`, answer: "integer", why: `$-\\sqrt{${squareBase * squareBase}}=-${squareBase}$, an integer.` }
        : kind === 8 ? { tex: `${n}.25`, answer: "rational", why: `$${n}.25$ is a terminating decimal, so it is rational.` }
        : { tex: `\\pi+${n}`, answer: "irrational", why: `Adding the integer $${n}$ to irrational $\\pi$ is still irrational.` };
      problems.push(makeProblem({
        topic_id: topicId,
        difficulty,
        prompt_latex: `What is the smallest listed set containing $${item.tex}$?`,
        correct_answer: item.answer,
        answer_type: "string",
        accepted_forms: [],
        solution_latex: item.why,
        complexity_factor: 0.8,
        source_section: source,
        tags: commonTags,
        choiceValues: ["natural", "integer", "rational", "irrational", "real"],
        choiceStyle: "plain",
        index: problems.length,
      }));
    }
  } else if (difficulty === "medium") {
    for (let i = 0; i < 50; i++) {
      const a = i + 2;
      const square = a * a;
      const nonsquare = square + (i % 5) + 2;
      const rationalCount = 3;
      const list = `$\\sqrt{${square}}$, $\\sqrt{${nonsquare}}$, $\\frac{${a + 1}}{${a + 3}}$, $-${a}$, $\\pi$`;
      problems.push(makeProblem({
        topic_id: topicId,
        difficulty,
        prompt_latex: `How many numbers in the list ${list} are rational?`,
        correct_answer: String(rationalCount),
        answer_type: "integer",
        accepted_forms: [],
        solution_latex: `$\\sqrt{${square}}=${a}$, $\\frac{${a + 1}}{${a + 3}}$, and $-${a}$ are rational. The other two are irrational.`,
        complexity_factor: 1.0,
        source_section: source,
        tags: [...commonTags, "rational"],
        choiceValues: ["1", "2", "3", "4"],
        choiceStyle: "math",
        index: i,
      }));
    }
  } else {
    for (let i = 0; i < 50; i++) {
      const start = i + 2;
      const end = start + 15;
      const first = Math.ceil(Math.sqrt(start));
      const last = Math.floor(Math.sqrt(end));
      const count = Math.max(0, last - first + 1);
      problems.push(makeProblem({
        topic_id: topicId,
        difficulty,
        prompt_latex: `For how many integers $n$ with $${start}\\le n\\le ${end}$ is $\\sqrt{n}$ rational?`,
        correct_answer: String(count),
        answer_type: "integer",
        accepted_forms: [],
        solution_latex: `$\\sqrt{n}$ is rational exactly when $n$ is a perfect square. The squares in the interval are from $${first}^2$ through $${last}^2$, giving $${count}$.`,
        complexity_factor: 1.2,
        source_section: source,
        tags: [...commonTags, "perfect-squares"],
        choiceValues: [String(Math.max(0, count - 1)), String(count), String(count + 1), String(count + 2)],
        choiceStyle: "math",
        index: i,
      }));
    }
  }

  return problems;
}

function generateImaginary(difficulty: Difficulty): Problem[] {
  const topicId = "ch12.imaginary";
  const source = "12.2";
  const problems: Problem[] = [];
  const commonTags = ["imaginary", "i-powers"];

  if (difficulty === "easy") {
    for (let i = 0; i < 50; i++) {
      if (i % 2 === 0) {
        const exponent = 13 + i;
        const answer = iPower(exponent);
        problems.push(makeProblem({
          topic_id: topicId,
          difficulty,
          prompt_latex: `Simplify $i^{${exponent}}$.`,
          correct_answer: answer,
          answer_type: "string",
          accepted_forms: answer === "i" ? ["1i"] : answer === "-i" ? ["-1i"] : [],
          solution_latex: `Powers of $i$ repeat every $4$. Since $${exponent}\\equiv ${exponent % 4}\\pmod 4$, $i^{${exponent}}=${answer}$.`,
          complexity_factor: 0.85,
          source_section: source,
          tags: commonTags,
          choiceValues: ["1", "i", "-1", "-i"],
          choiceStyle: "math",
          index: i,
        }));
      } else {
        const root = 2 + i;
        const radicand = root * root;
        const answer = fmtImag(root);
        problems.push(makeProblem({
          topic_id: topicId,
          difficulty,
          prompt_latex: `Simplify $\\sqrt{-${radicand}}$.`,
          correct_answer: answer,
          answer_type: "string",
          accepted_forms: [`${root} i`],
          solution_latex: `$\\sqrt{-${radicand}}=\\sqrt{${radicand}}\\sqrt{-1}=${root}i$.`,
          complexity_factor: 0.85,
          source_section: source,
          tags: [...commonTags, "square-roots"],
          choiceValues: [answer, fmtImag(-root), String(root), String(-root)],
          choiceStyle: "math",
          index: i,
        }));
      }
    }
  } else if (difficulty === "medium") {
    for (let i = 0; i < 50; i++) {
      if (i % 2 === 0) {
        const a = 5 + i;
        const b = 9 + 2 * i;
        const values: Record<string, [number, number]> = { "1": [1, 0], "-1": [-1, 0], "i": [0, 1], "-i": [0, -1] };
        const left = values[iPower(a)];
        const right = values[iPower(b)];
        const answer = fmtComplex(left[0] + right[0], left[1] + right[1]);
        problems.push(makeProblem({
          topic_id: topicId,
          difficulty,
          prompt_latex: `Simplify $i^{${a}}+i^{${b}}$.`,
          correct_answer: answer,
          answer_type: "string",
          accepted_forms: acceptedComplex(left[0] + right[0], left[1] + right[1]),
          solution_latex: `Reduce each exponent modulo $4$: $i^{${a}}=${iPower(a)}$ and $i^{${b}}=${iPower(b)}$, so the sum is $${answer}$.`,
          complexity_factor: 1.0,
          source_section: source,
          tags: commonTags,
          choiceValues: [answer, fmtComplex(left[0] - right[0], left[1] - right[1]), fmtComplex(-left[0] + right[0], -left[1] + right[1]), fmtComplex(left[0] + right[0] + 1, left[1] + right[1])],
          choiceStyle: "math",
          index: i,
        }));
      } else {
        const a = 2 + (i % 9);
        const b = 3 + (i % 7);
        const answer = String(-a * b);
        problems.push(makeProblem({
          topic_id: topicId,
          difficulty,
          prompt_latex: `Simplify $(\\sqrt{-${a * a}})(\\sqrt{-${b * b}})$.`,
          correct_answer: answer,
          answer_type: "string",
          accepted_forms: [],
          solution_latex: `$\\sqrt{-${a * a}}=${a}i$ and $\\sqrt{-${b * b}}=${b}i$, so the product is $${a * b}i^2=${answer}$.`,
          complexity_factor: 1.0,
          source_section: source,
          tags: [...commonTags, "square-roots", "multiplication"],
          choiceValues: [answer, String(a * b), fmtImag(a * b), fmtImag(-(a * b))],
          choiceStyle: "math",
          index: i,
        }));
      }
    }
  } else {
    for (let i = 0; i < 50; i++) {
      if (i % 2 === 0) {
        const a = 2 + i;
        const b = 3 + i;
        const real = 1 - a * b;
        const imag = a + b;
        const answer = fmtComplex(real, imag);
        problems.push(makeProblem({
          topic_id: topicId,
          difficulty,
          prompt_latex: `Simplify $(1+\\sqrt{-${a * a}})(1+\\sqrt{-${b * b}})$.`,
          correct_answer: answer,
          answer_type: "string",
          accepted_forms: acceptedComplex(real, imag),
          solution_latex: `This is $(1+${a}i)(1+${b}i)$. The real part is $1-${a}\\cdot ${b}=${real}$ and the imaginary part is $${a}+${b}=${imag}$, so the result is $${answer}$.`,
          complexity_factor: 1.2,
          source_section: source,
          tags: [...commonTags, "square-roots", "multiplication"],
          choiceValues: [answer, fmtComplex(-real, imag), fmtComplex(real, -imag), fmtComplex(real + 1, imag)],
          choiceStyle: "math",
          index: i,
        }));
      } else {
        const a = 4 + i;
        const b = 11 + 2 * i;
        const c = 17 + 3 * i;
        const values: Record<string, [number, number]> = { "1": [1, 0], "-1": [-1, 0], "i": [0, 1], "-i": [0, -1] };
        const va = values[iPower(a)];
        const vb = values[iPower(b)];
        const vc = values[iPower(c)];
        const real = va[0] + vb[0] - vc[0];
        const imag = va[1] + vb[1] - vc[1];
        const answer = fmtComplex(real, imag);
        problems.push(makeProblem({
          topic_id: topicId,
          difficulty,
          prompt_latex: `Simplify $i^{${a}}+i^{${b}}-i^{${c}}$.`,
          correct_answer: answer,
          answer_type: "string",
          accepted_forms: acceptedComplex(real, imag),
          solution_latex: `Reduce $${a}$, $${b}$, and $${c}$ modulo $4$, then combine the resulting values of $1$, $i$, $-1$, and $-i$ to get $${answer}$.`,
          complexity_factor: 1.2,
          source_section: source,
          tags: commonTags,
          choiceValues: [answer, fmtComplex(real + 1, imag), fmtComplex(real, imag + 1), fmtComplex(-real, -imag)],
          choiceStyle: "math",
          index: i,
        }));
      }
    }
  }

  return problems;
}

function generateComplex(difficulty: Difficulty): Problem[] {
  const topicId = "ch12.complex";
  const source = "12.3";
  const problems: Problem[] = [];
  const commonTags = ["complex", "operations"];

  for (let i = 0; i < 50; i++) {
    const a = (i % 9) - 4;
    const b = (i % 7) + 2;
    const c = (i % 8) - 3;
    const d = (i % 6) + 1;

    if (difficulty === "easy") {
      const real = i % 2 === 0 ? a + c : a - c;
      const imag = i % 2 === 0 ? b + d : b - d;
      const op = i % 2 === 0 ? "+" : "-";
      const answer = fmtComplex(real, imag);
      problems.push(makeProblem({
        topic_id: topicId,
        difficulty,
        prompt_latex: `Simplify $(${fmtComplex(a, b)})${op}(${fmtComplex(c, d)})$.`,
        correct_answer: answer,
        answer_type: "string",
        accepted_forms: acceptedComplex(real, imag),
        solution_latex: `Combine real parts and imaginary parts separately to get $${answer}$.`,
        complexity_factor: 0.95,
        source_section: source,
        tags: [...commonTags, i % 2 === 0 ? "addition" : "subtraction"],
        choiceValues: [answer, fmtComplex(real, -imag), fmtComplex(a + c, b - d), fmtComplex(a - c, b + d)],
        choiceStyle: "math",
        index: i,
      }));
    } else if (difficulty === "medium") {
      if (i % 2 === 0) {
        const real = a * c - b * d;
        const imag = a * d + b * c;
        const answer = fmtComplex(real, imag);
        problems.push(makeProblem({
          topic_id: topicId,
          difficulty,
          prompt_latex: `Multiply $(${fmtComplex(a, b)})(${fmtComplex(c, d)})$.`,
          correct_answer: answer,
          answer_type: "string",
          accepted_forms: acceptedComplex(real, imag),
          solution_latex: `Use $i^2=-1$: real part $${a}\\cdot ${c}-${b}\\cdot ${d}=${real}$ and imaginary part $${a}\\cdot ${d}+${b}\\cdot ${c}=${imag}$.`,
          complexity_factor: 1.1,
          source_section: source,
          tags: [...commonTags, "multiplication"],
          choiceValues: [answer, fmtComplex(a * c + b * d, imag), fmtComplex(real, a * d - b * c), fmtComplex(a * c, b * d)],
          choiceStyle: "math",
          index: i,
        }));
      } else {
        const real = a;
        const imag = -b;
        const answer = fmtComplex(real, imag);
        problems.push(makeProblem({
          topic_id: topicId,
          difficulty,
          prompt_latex: `What is the conjugate of $${fmtComplex(a, b)}$?`,
          correct_answer: answer,
          answer_type: "string",
          accepted_forms: acceptedComplex(real, imag),
          solution_latex: `The conjugate keeps the real part and changes the sign of the imaginary part, giving $${answer}$.`,
          complexity_factor: 1.05,
          source_section: source,
          tags: [...commonTags, "conjugate"],
          choiceValues: [answer, fmtComplex(-real, imag), fmtComplex(real, b), fmtComplex(-real, -imag)],
          choiceStyle: "math",
          index: i,
        }));
      }
    } else {
      if (i % 2 === 0) {
        const u = (i % 6) + 2;
        const v = (i % 3) + 1;
        const targetReal = (i % 7) - 3;
        const targetImag = (i % 5) + 1;
        const numeratorReal = targetReal * u - targetImag * v;
        const numeratorImag = targetReal * v + targetImag * u;
        const answer = fmtComplex(targetReal, targetImag);
        problems.push(makeProblem({
          topic_id: topicId,
          difficulty,
          prompt_latex: `Compute $\\dfrac{${fmtComplex(numeratorReal, numeratorImag)}}{${fmtComplex(u, v)}}$ in the form $a+bi$.`,
          correct_answer: answer,
          answer_type: "string",
          accepted_forms: acceptedComplex(targetReal, targetImag),
          solution_latex: `The numerator equals $(${answer})(${fmtComplex(u, v)})$, so dividing by $${fmtComplex(u, v)}$ gives $${answer}$.`,
          complexity_factor: 1.3,
          source_section: source,
          tags: [...commonTags, "division", "conjugate"],
          choiceValues: [answer, fmtComplex(targetReal, -targetImag), fmtComplex(targetReal + 1, targetImag), fmtComplex(numeratorReal, numeratorImag)],
          choiceStyle: "math",
          index: i,
        }));
      } else {
        const real = a * a - b * b + c;
        const imag = 2 * a * b + d;
        const answer = fmtComplex(real, imag);
        problems.push(makeProblem({
          topic_id: topicId,
          difficulty,
          prompt_latex: `Simplify $(${fmtComplex(a, b)})^2+(${fmtComplex(c, d)})$.`,
          correct_answer: answer,
          answer_type: "string",
          accepted_forms: acceptedComplex(real, imag),
          solution_latex: `Square first: $(${fmtComplex(a, b)})^2=${fmtComplex(a * a - b * b, 2 * a * b)}$. Then add $${fmtComplex(c, d)}$ to get $${answer}$.`,
          complexity_factor: 1.3,
          source_section: source,
          tags: [...commonTags, "squares"],
          choiceValues: [answer, fmtComplex(a * a + b * b + c, imag), fmtComplex(real, -imag), fmtComplex(real - c, imag - d)],
          choiceStyle: "math",
          index: i,
        }));
      }
    }
  }

  return problems;
}

function writeFile(topicId: string, difficulty: Difficulty, problems: Problem[]): void {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${topicId}.${difficulty}.json`);
  fs.writeFileSync(file, JSON.stringify(problems, null, 2) + "\n");
}

for (const difficulty of ["easy", "medium", "hard"] as const) {
  writeFile("ch12.more_numbers", difficulty, generateMoreNumbers(difficulty));
  writeFile("ch12.imaginary", difficulty, generateImaginary(difficulty));
  writeFile("ch12.complex", difficulty, generateComplex(difficulty));
}

console.log("Generated Chapter 12 complex problem files.");
