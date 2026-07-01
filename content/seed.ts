import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

interface ProblemRow {
  id: string;
  topic_id: string;
  group_id: string;
  difficulty: "easy" | "medium" | "hard";
  prompt_latex: string;
  answer_format: "mc" | "numeric" | "exact";
  choices?: { id: string; latex: string }[];
  correct_choice?: string;
  correct_answer: string;
  answer_type: string;
  accepted_forms?: string[];
  solution_latex: string;
  complexity_factor: number;
  source_section?: string;
  tags: string[];
  checksum: string;
  status: string;
}

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

function readProblems(): ProblemRow[] {
  const problemsDir = path.join(process.cwd(), "content", "problems");
  const files = collectJsonFiles(problemsDir);
  const problems: ProblemRow[] = [];

  for (const file of files) {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (!Array.isArray(parsed)) {
      throw new Error(`Problem file is not an array: ${file}`);
    }
    problems.push(...parsed);
  }

  return problems;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required to seed Supabase`);
  }
  return value;
}

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadLocalEnv();

  const validation = spawnSync("npx", ["tsx", "content/validator.ts"], {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (validation.status !== 0) {
    throw new Error("Refusing to seed because validation failed");
  }

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const problems = readProblems().filter((problem) => problem.status === "valid");
  const topicCounts = new Map<string, number>();
  for (const problem of problems) {
    topicCounts.set(problem.topic_id, (topicCounts.get(problem.topic_id) ?? 0) + 1);
  }

  const batchSize = 500;

  for (let i = 0; i < problems.length; i += batchSize) {
    const batch = problems.slice(i, i + batchSize).map((problem) => ({
      ...problem,
      accepted_forms: problem.accepted_forms ?? [],
      choices: problem.choices ?? null,
    }));
    const { error } = await supabase.from("problems").upsert(batch, {
      onConflict: "checksum",
    });

    if (error) {
      throw new Error(`Seed failed at batch ${i / batchSize + 1}: ${error.message}`);
    }

    console.log(`Seeded ${Math.min(i + batch.length, problems.length)} / ${problems.length}`);
  }

  const { count: totalCount, error: totalError } = await supabase
    .from("problems")
    .select("id", { count: "exact", head: true })
    .eq("status", "valid");

  if (totalError) {
    throw new Error(`Unable to verify remote problem count: ${totalError.message}`);
  }

  console.log("Seeded row counts per topic:");
  for (const [topicId, expectedCount] of [...topicCounts.entries()].sort()) {
    const { count, error } = await supabase
      .from("problems")
      .select("id", { count: "exact", head: true })
      .eq("status", "valid")
      .eq("topic_id", topicId);

    if (error) {
      throw new Error(`Unable to verify topic ${topicId}: ${error.message}`);
    }

    console.log(`${topicId}: ${count} rows (expected ${expectedCount})`);
  }

  console.log(`Seed complete: ${problems.length} valid problems upserted`);
  console.log(`Remote valid problem total: ${totalCount}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
