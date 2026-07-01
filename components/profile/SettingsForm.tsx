"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import taxonomy from "@/content/taxonomy.json";
import { ensureGuestProfile, saveGuestProfile, type GuestProfile } from "@/lib/guestProfile";

export function SettingsForm() {
  const [profile, setProfile] = useState<GuestProfile | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setProfile(ensureGuestProfile());
  }, []);

  function updateSettings(patch: Partial<GuestProfile["settings"]>) {
    setSaved(false);
    setProfile((current) =>
      current ? { ...current, settings: { ...current.settings, ...patch } } : current
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    saveGuestProfile(profile);
    setSaved(true);
  }

  if (!profile) {
    return <div className="text-ftw-muted">Loading settings...</div>;
  }

  return (
    <form onSubmit={submit} className="w-full max-w-3xl rounded-3xl border border-gray-800 bg-ftw-panel p-6 shadow-xl">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-ftw-accent">Preferences</p>
      <h1 className="mt-2 text-4xl font-black">Settings</h1>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm text-ftw-muted">
          Theme
          <select
            value={profile.settings.theme}
            onChange={(event) =>
              updateSettings({ theme: event.target.value as GuestProfile["settings"]["theme"] })
            }
            className="rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-ftw-text outline-none focus:border-ftw-accent"
          >
            <option value="dark">Dark</option>
            <option value="high_contrast">High contrast</option>
            <option value="system">System</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-ftw-muted">
          LaTeX size
          <select
            value={profile.settings.latex_size}
            onChange={(event) =>
              updateSettings({ latex_size: event.target.value as GuestProfile["settings"]["latex_size"] })
            }
            className="rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-ftw-text outline-none focus:border-ftw-accent"
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-ftw-muted">
          Default difficulty
          <select
            value={profile.settings.default_difficulty}
            onChange={(event) =>
              updateSettings({
                default_difficulty: event.target.value as GuestProfile["settings"]["default_difficulty"],
              })
            }
            className="rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-ftw-text outline-none focus:border-ftw-accent"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-ftw-muted">
          Timezone
          <input
            value={profile.settings.timezone}
            onChange={(event) => updateSettings({ timezone: event.target.value })}
            className="rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-ftw-text outline-none focus:border-ftw-accent"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-ftw-muted md:col-span-2">
          Default topic
          <select
            value={profile.settings.default_topic_id}
            onChange={(event) => updateSettings({ default_topic_id: event.target.value })}
            className="rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-ftw-text outline-none focus:border-ftw-accent"
          >
            <option value="">No preset</option>
            {taxonomy.groups.map((group) => (
              <optgroup key={group.group_id} label={group.display_name}>
                {group.leaves.map((leaf) => (
                  <option key={leaf.topic_id} value={leaf.topic_id}>
                    {leaf.display_name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className="flex items-center justify-between gap-4 rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-ftw-muted md:col-span-2">
          Sound effects
          <input
            type="checkbox"
            checked={profile.settings.sound}
            onChange={(event) => updateSettings({ sound: event.target.checked })}
            className="h-5 w-5 accent-ftw-accent"
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
          Save Settings
        </button>
        <Link
          href="/profile"
          className="rounded-xl border border-gray-700 px-5 py-3 font-bold hover:border-ftw-text"
        >
          Back to Profile
        </Link>
      </div>
    </form>
  );
}
