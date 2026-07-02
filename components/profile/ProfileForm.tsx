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
      <form onSubmit={submit} className="ftw-card p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="ftw-label text-ftw-accent">
              Local profile
            </p>
            <h1 className="ftw-display mt-2 text-4xl">Profile</h1>
          </div>
          <div className="ftw-chip text-sm">
            {supabaseReady ? "Supabase ready" : "Guest storage active"}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-ftw-muted">
            Username
            <input
              value={profile.username}
              onChange={(event) => updateProfile({ username: event.target.value })}
              className="ftw-input"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-ftw-muted">
            Display name
            <input
              value={profile.display_name}
              onChange={(event) => updateProfile({ display_name: event.target.value })}
              className="ftw-input"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-ftw-muted">
            Avatar URL
            <input
              value={profile.avatar}
              onChange={(event) => updateProfile({ avatar: event.target.value })}
              className="ftw-input"
              placeholder="Storage URL later"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-ftw-muted">
            Title
            <input
              value={profile.title}
              onChange={(event) => updateProfile({ title: event.target.value })}
              className="ftw-input"
            />
          </label>
        </div>

        {saved && (
          <div className="mt-4 rounded-xl border border-ftw-success/50 bg-ftw-success/10 px-4 py-3 text-sm text-ftw-success">
            Saved to local guest profile.
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button className="ftw-button-primary">
            Save Profile
          </button>
          <Link
            href="/settings"
            className="ftw-button-secondary"
          >
            Settings
          </Link>
          <Link
            href="/claim"
            className="rounded-ftw-sm border border-ftw-info bg-ftw-info/10 px-5 py-3 font-bold text-ftw-info shadow-ftw-sm transition hover:bg-ftw-info hover:text-ftw-panel"
          >
            Claim Account
          </Link>
        </div>
      </form>

      <aside className="ftw-card-muted p-6">
        <div className="ftw-number text-5xl text-ftw-accent">{profile.rating}</div>
        <div className="text-sm text-ftw-muted">Global rating</div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Stat label="Level" value={profile.level.toString()} />
          <Stat label="XP" value={profile.xp.toString()} />
          <Stat label="Current streak" value={profile.streak.current.toString()} />
          <Stat label="Best streak" value={profile.streak.longest.toString()} />
        </div>

      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="ftw-card-sm p-4">
      <div className="ftw-number text-2xl">{value}</div>
      <div className="ftw-label text-ftw-muted">{label}</div>
    </div>
  );
}
