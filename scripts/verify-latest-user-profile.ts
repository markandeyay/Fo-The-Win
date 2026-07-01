import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    process.env[line.slice(0, index).trim()] ||= line.slice(index + 1).trim();
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  loadLocalEnv();
  const service = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );

  const users = await service.auth.admin.listUsers({ page: 1, perPage: 20 });
  if (users.error) throw users.error;

  const latest = [...users.data.users]
    .filter((user) => !user.is_anonymous)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];

  if (!latest) throw new Error("No non-anonymous auth user found");

  const { data, error } = await service
    .from("profiles")
    .select("id, username, display_name")
    .eq("id", latest.id)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Latest user has no profile row: ${error?.message ?? latest.id}`);
  }

  console.log(`latest non-anonymous user profile row ok: ${data.id}`);
  console.log(`email: ${latest.email ?? "none"}`);
  console.log(`username: ${data.username}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
