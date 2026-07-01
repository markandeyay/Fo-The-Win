import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

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
    process.env[key] ||= value;
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function expectReject(label: string, promise: PromiseLike<{ error: unknown }>) {
  const { error } = await promise;
  if (!error) {
    throw new Error(`${label} unexpectedly allowed direct client write`);
  }
  console.log(`${label}: rejected direct client write`);
}

async function main() {
  loadLocalEnv();

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = createClient(url, requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false },
  });
  const service = createClient(url, requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  const valid = await anon.from("problems").select("id,status").eq("status", "valid").limit(1);
  if (valid.error || !valid.data || valid.data.length !== 1) {
    throw new Error(`Anon valid problem read failed: ${valid.error?.message ?? "no rows"}`);
  }
  console.log("problems valid public read: ok");

  const testId = `rls-test-${crypto.randomUUID()}`;
  const testChecksum = `sha256-${crypto.randomUUID().replace(/-/g, "")}`;
  const { error: insertTestError } = await service.from("problems").insert({
    id: testId,
    topic_id: "ch1.numbers",
    group_id: "ch1_rules",
    difficulty: "easy",
    prompt_latex: "$1+1$",
    answer_format: "mc",
    choices: [
      { id: "a", latex: "$2$" },
      { id: "b", latex: "$1$" },
      { id: "c", latex: "$3$" },
      { id: "d", latex: "$4$" },
    ],
    correct_choice: "a",
    correct_answer: "2",
    answer_type: "integer",
    accepted_forms: [],
    solution_latex: "$1+1=2$",
    complexity_factor: 1,
    source_section: "rls",
    tags: ["rls_test"],
    checksum: testChecksum,
    status: "needs_review",
  });

  if (insertTestError) {
    throw new Error(`Unable to insert service-role RLS test problem: ${insertTestError.message}`);
  }

  try {
    const hidden = await anon.from("problems").select("id,status").eq("id", testId);
    if (hidden.error) {
      throw new Error(`Anon hidden problem query errored: ${hidden.error.message}`);
    }
    if ((hidden.data ?? []).length !== 0) {
      throw new Error("Anon client could read non-valid problem row");
    }
    console.log("problems non-valid public read: blocked");
  } finally {
    await service.from("problems").delete().eq("id", testId);
  }

  const userId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();

  await expectReject(
    "streaks",
    anon.from("streaks").insert({ user_id: userId, current_streak: 1 })
  );
  await expectReject(
    "rating_events",
    anon.from("rating_events").insert({ user_id: userId, delta: 1, new_rating: 1201 })
  );
  await expectReject(
    "session_players",
    anon.from("session_players").insert({ session_id: sessionId, user_id: userId, score: 1 })
  );
  await expectReject(
    "round_answers",
    anon.from("round_answers").insert({
      session_id: sessionId,
      round_index: 0,
      user_id: userId,
      submitted: "a",
      is_correct: false,
      time_ms: 1,
      points: 1,
    })
  );

  console.log("RLS verification complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
