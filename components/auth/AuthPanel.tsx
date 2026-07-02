"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { ensureCurrentUserProfile, getAuthRedirectUrl } from "@/lib/auth";
import { ensureGuestProfile } from "@/lib/guestProfile";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type AuthPanelProps = {
  mode: "signin" | "signup";
};

export function AuthPanel({ mode }: AuthPanelProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isSignup = mode === "signup";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Supabase env vars are empty. Guest mode is available for local play.");
      return;
    }

    const result = isSignup
      ? await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getAuthRedirectUrl(),
            data: {
              username,
              display_name: displayName,
            },
          },
        })
      : await supabase.auth.signInWithPassword({ email, password });

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (isSignup && !result.data.session) {
      setMessage("Account created. Check your email if confirmations are enabled, then sign in.");
      return;
    }

    const profileResult = await ensureCurrentUserProfile(supabase);
    if (profileResult.error) {
      setMessage(profileResult.error.message);
      return;
    }

    startTransition(() => router.push("/"));
  }

  async function signInWithGoogle() {
    setMessage(null);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Supabase env vars are empty. Google sign-in needs Supabase config.");
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getAuthRedirectUrl(),
      },
    });

    if (error) {
      setMessage(error.message);
    }
  }

  async function continueAsGuest() {
    setMessage(null);
    const localGuest = ensureGuestProfile();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      startTransition(() => router.push("/"));
      return;
    }

    const { error } = await supabase.auth.signInAnonymously({
      options: {
        data: {
          username: localGuest.username,
          display_name: localGuest.display_name,
        },
      },
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    const profileResult = await ensureCurrentUserProfile(supabase);
    if (profileResult.error) {
      setMessage(profileResult.error.message);
      return;
    }

    startTransition(() => router.push("/"));
  }

  return (
    <div className="ftw-card w-full max-w-lg p-6 md:p-8">
      <div className="mb-6">
        <p className="ftw-label text-ftw-accent">
          Fo The Win
        </p>
        <h1 className="ftw-display mt-2 text-4xl text-ftw-text">
          {isSignup ? "Create your account" : "Enter the arena"}
        </h1>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        {isSignup && (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm text-ftw-muted">
              Username
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="ftw-input"
                placeholder="number_ninja"
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-ftw-muted">
              Display name
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="ftw-input"
                placeholder="Ada"
                required
              />
            </label>
          </div>
        )}

        <label className="flex flex-col gap-2 text-sm text-ftw-muted">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="ftw-input"
            placeholder="player@example.com"
            required
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-ftw-muted">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="ftw-input"
            minLength={6}
            required
          />
        </label>

        {message && (
          <div className="rounded-xl border border-ftw-info/40 bg-ftw-info/10 px-4 py-3 text-sm text-ftw-info">
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="ftw-button-primary"
        >
          {isSignup ? "Sign Up" : "Sign In"}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-ftw-muted">
        <div className="h-px flex-1 bg-ftw-line" />
        or
        <div className="h-px flex-1 bg-ftw-line" />
      </div>

      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={isPending}
        className="w-full rounded-xl border border-ftw-info bg-ftw-info/10 px-5 py-3 font-bold text-ftw-info transition hover:bg-ftw-info hover:text-ftw-panel disabled:cursor-not-allowed disabled:opacity-60"
      >
        Continue with Google
      </button>

      <button
        type="button"
        onClick={continueAsGuest}
        disabled={isPending}
        className="w-full rounded-xl border border-ftw-success bg-ftw-success/10 px-5 py-3 font-bold text-ftw-success transition hover:bg-ftw-success hover:text-ftw-panel disabled:cursor-not-allowed disabled:opacity-60"
      >
        Continue as Guest
      </button>

      <div className="mt-6 flex flex-wrap justify-between gap-3 text-sm text-ftw-muted">
        <Link href={isSignup ? "/signin" : "/signup"} className="hover:text-ftw-text">
          {isSignup ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </Link>
        <Link href="/claim" className="hover:text-ftw-text">
          Claim guest progress
        </Link>
      </div>
    </div>
  );
}
