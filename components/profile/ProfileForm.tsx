"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ensureGuestProfile, saveGuestProfile, type GuestProfile } from "@/lib/guestProfile";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function ProfileForm() {
  const [profile, setProfile] = useState<GuestProfile | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setProfile(ensureGuestProfile());
  }, []);

  function updateProfile(patch: Partial<GuestProfile>) {
    setSaved(false);
    setProfile((current) => (current ? { ...current, ...patch } : current));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    saveGuestProfile(profile);
    setSaved(true);
  }

  if (!profile) {
    return <div className="text-ftw-muted">Loading profile...</div>;
  }

  const supabaseReady = isSupabaseConfigured();

  return (
    <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_22rem]">
      <form onSubmit={submit} className="rounded-3xl border border-gray-800 bg-ftw-panel p-6 shadow-xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-ftw-accent">
              Local profile
            </p>
            <h1 className="mt-2 text-4xl font-black">Profile</h1>
          </div>
          <div className="rounded-full border border-gray-700 px-4 py-2 text-sm text-ftw-muted">
            {supabaseReady ? "Supabase ready" : "Guest storage active"}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-ftw-muted">
            Username
            <input
              value={profile.username}
              onChange={(event) => updateProfile({ username: event.target.value })}
              className="rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-ftw-text outline-none focus:border-ftw-accent"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-ftw-muted">
            Display name
            <input
              value={profile.display_name}
              onChange={(event) => updateProfile({ display_name: event.target.value })}
              className="rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-ftw-text outline-none focus:border-ftw-accent"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-ftw-muted">
            Avatar URL
            <input
              value={profile.avatar}
              onChange={(event) => updateProfile({ avatar: event.target.value })}
              className="rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-ftw-text outline-none focus:border-ftw-accent"
              placeholder="Storage URL later"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-ftw-muted">
            Title
            <input
              value={profile.title}
              onChange={(event) => updateProfile({ title: event.target.value })}
              className="rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-ftw-text outline-none focus:border-ftw-accent"
            />
          </label>
        </div>

        {saved && (
          <div className="mt-4 rounded-xl border border-ftw-success/50 bg-ftw-success/10 px-4 py-3 text-sm text-green-100">
            Saved to local guest profile.
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button className="rounded-xl bg-ftw-accent px-5 py-3 font-black text-ftw-dark hover:bg-amber-300">
            Save Profile
          </button>
          <Link
            href="/settings"
            className="rounded-xl border border-gray-700 px-5 py-3 font-bold hover:border-ftw-text"
          >
            Settings
          </Link>
          <Link
            href="/claim"
            className="rounded-xl border border-ftw-info px-5 py-3 font-bold text-blue-100 hover:bg-ftw-info hover:text-white"
          >
            Claim Account
          </Link>
        </div>
      </form>

      <aside className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
        <div className="text-5xl font-black text-ftw-accent">{profile.rating}</div>
        <div className="text-sm text-ftw-muted">Global rating</div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Stat label="Level" value={profile.level.toString()} />
          <Stat label="XP" value={profile.xp.toString()} />
          <Stat label="Current streak" value={profile.streak.current.toString()} />
          <Stat label="Best streak" value={profile.streak.longest.toString()} />
        </div>

        <p className="mt-6 text-sm leading-6 text-ftw-muted">
          This form writes local guest data now. The same fields map directly to the Supabase
          <span className="font-mono text-ftw-text"> profiles</span> row and related stats tables later.
        </p>
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-ftw-panel p-4">
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs uppercase tracking-[0.2em] text-ftw-muted">{label}</div>
    </div>
  );
}
