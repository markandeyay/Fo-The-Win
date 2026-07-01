"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { applyGuestProfileToCurrentUser, getAuthRedirectUrl } from "@/lib/auth";
import { ensureGuestProfile, type GuestProfile } from "@/lib/guestProfile";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function ClaimAccountPage() {
  const [profile, setProfile] = useState<GuestProfile | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setProfile(ensureGuestProfile());
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Supabase env vars are empty. Claiming needs Supabase Auth.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const isAnonymous = Boolean((userData.user as { is_anonymous?: boolean } | null)?.is_anonymous);

    if (userData.user && isAnonymous) {
      const { error } = await supabase.auth.updateUser(
        {
          email,
          password,
          data: {
            claim_guest_profile: true,
            username: profile?.username,
            display_name: profile?.display_name,
          },
        },
        { emailRedirectTo: getAuthRedirectUrl() }
      );

      if (error) {
        setMessage(error.message);
        return;
      }

      const profileResult = await applyGuestProfileToCurrentUser(supabase);
      if (profileResult.error) {
        setMessage(profileResult.error.message);
        return;
      }

      setMessage("Guest account upgraded. Confirm your email if Supabase requires it.");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getAuthRedirectUrl(),
        data: {
          claim_guest_profile: true,
          username: profile?.username,
          display_name: profile?.display_name,
        },
      },
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Account created. Sign in after email confirmation if required, then your guest profile can be applied.");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#082f49_0,#0b0f19_42%,#05070d_100%)] px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
        <div className="w-full max-w-xl rounded-3xl border border-ftw-info/40 bg-ftw-panel p-6 shadow-2xl md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-ftw-info">
            Claim account
          </p>
          <h1 className="mt-2 text-4xl font-black">Keep your guest progress</h1>
          <p className="mt-3 text-sm leading-6 text-ftw-muted">
            If you are currently playing as an anonymous guest, this upgrades the same auth
            user to email/password and copies local guest profile fields to your profile row.
          </p>

          {profile && (
            <div className="mt-5 rounded-2xl border border-gray-800 bg-gray-950 p-4">
              <div className="text-xl font-black">{profile.display_name}</div>
              <div className="text-sm text-ftw-muted">@{profile.username}</div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-xl bg-ftw-panel p-3">
                  <div className="font-black text-ftw-accent">{profile.xp}</div>
                  <div className="text-ftw-muted">XP</div>
                </div>
                <div className="rounded-xl bg-ftw-panel p-3">
                  <div className="font-black text-ftw-accent">{profile.level}</div>
                  <div className="text-ftw-muted">Level</div>
                </div>
                <div className="rounded-xl bg-ftw-panel p-3">
                  <div className="font-black text-ftw-accent">{profile.rating}</div>
                  <div className="text-ftw-muted">Rating</div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-2 text-sm text-ftw-muted">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-ftw-text outline-none focus:border-ftw-info"
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-ftw-muted">
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-ftw-text outline-none focus:border-ftw-info"
                minLength={6}
                required
              />
            </label>

            {message && (
              <div className="rounded-xl border border-ftw-info/40 bg-ftw-info/10 px-4 py-3 text-sm text-blue-100">
                {message}
              </div>
            )}

            <button className="rounded-xl bg-ftw-info px-5 py-3 font-black text-white hover:bg-blue-400">
              Claim Guest Account
            </button>
          </form>

          <div className="mt-6 flex flex-wrap gap-3 text-sm text-ftw-muted">
            <Link href="/profile" className="hover:text-ftw-text">Back to profile</Link>
            <Link href="/signin" className="hover:text-ftw-text">Sign in instead</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
