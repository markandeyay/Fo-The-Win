import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

async function requireProfile(service: SupabaseClient, userId: string, label: string) {
  const { data, error } = await service
    .from("profiles")
    .select("id, username, display_name")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`${label} did not create a profiles row: ${error?.message ?? "missing row"}`);
  }

  const profile = data as { id: string };
  console.log(`${label}: profiles row ok (${profile.id})`);
}

async function main() {
  loadLocalEnv();

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const redirectTo = "http://localhost:3000/auth/callback";
  const service = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  if (process.env.SKIP_EMAIL !== "1") {
    const emailClient = createClient(url, anonKey, { auth: { persistSession: false } });
    const email = `ftw.auth.test.${Date.now()}@gmail.com`;
    const password = `Ftw-test-${Date.now()}!a`;
    const signUp = await emailClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          username: "auth_test",
          display_name: "Auth Test",
        },
      },
    });

    if (signUp.error || !signUp.data.user) {
      throw new Error(`Email/password sign-up failed: ${signUp.error?.message ?? "missing user"}`);
    }

    await requireProfile(service, signUp.data.user.id, "email/password sign-up");

    const signIn = await emailClient.auth.signInWithPassword({ email, password });
    if (signIn.error) {
      console.log(`email/password sign-in: gated by Supabase email confirmation (${signIn.error.message})`);
    } else {
      console.log("email/password sign-in: ok");
    }

    await service.auth.admin.deleteUser(signUp.data.user.id);
    console.log("email/password test user cleaned up");
  } else {
    console.log("email/password verification skipped by SKIP_EMAIL=1");
  }

  const confirmedEmail = `ftw.auth.confirmed.${Date.now()}@gmail.com`;
  const confirmedPassword = `Ftw-confirmed-${Date.now()}!a`;
  const created = await service.auth.admin.createUser({
    email: confirmedEmail,
    password: confirmedPassword,
    email_confirm: true,
    user_metadata: {
      username: "confirmed_test",
      display_name: "Confirmed Test",
    },
  });

  if (created.error || !created.data.user) {
    throw new Error(`Confirmed email/password test user creation failed: ${created.error?.message ?? "missing user"}`);
  }

  try {
    await requireProfile(service, created.data.user.id, "confirmed email/password user");
    const confirmedClient = createClient(url, anonKey, { auth: { persistSession: false } });
    const confirmedSignIn = await confirmedClient.auth.signInWithPassword({
      email: confirmedEmail,
      password: confirmedPassword,
    });
    if (confirmedSignIn.error) {
      throw new Error(`confirmed email/password sign-in failed: ${confirmedSignIn.error.message}`);
    }
    console.log("confirmed email/password sign-in: ok");
  } finally {
    await service.auth.admin.deleteUser(created.data.user.id);
    console.log("confirmed email/password test user cleaned up");
  }

  const guestClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const guest = await guestClient.auth.signInAnonymously({
    options: {
      data: {
        username: "guest_verify",
        display_name: "Guest Verify",
      },
    },
  });

  if (guest.error || !guest.data.user) {
    throw new Error(`anonymous guest sign-in failed: ${guest.error?.message ?? "missing user"}`);
  }

  await requireProfile(service, guest.data.user.id, "anonymous guest sign-in");
  await service.auth.admin.deleteUser(guest.data.user.id);
  console.log("anonymous guest test user cleaned up");

  const oauthClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const google = await oauthClient.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (google.error || !google.data.url) {
    throw new Error(`Google OAuth start failed: ${google.error?.message ?? "missing url"}`);
  }

  const googleUrl = new URL(google.data.url);
  if (!googleUrl.searchParams.get("redirect_to")?.startsWith(redirectTo)) {
    throw new Error("Google OAuth redirect_to is not pointed at local callback");
  }

  console.log("Google OAuth initiation: ok, redirect points to local callback");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
