"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import taxonomy from "@/content/taxonomy.json";
import {
  ensureGuestProfile,
  saveGuestProfile,
  type GuestMatchHistoryRow,
  type GuestProfile,
  type GuestRacePersonalBest,
  type GuestTopicStat,
} from "@/lib/guestProfile";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

const ACHIEVEMENTS = [
  {
    key: "first_win",
    name: "First Win",
    description: "Win a solo or multiplayer session.",
  },
  {
    key: "seven_day_streak",
    name: "7-Day Streak",
    description: "Complete at least one session daily for 7 days.",
  },
  {
    key: "thirty_day_streak",
    name: "30-Day Streak",
    description: "Keep a daily streak alive for 30 days.",
  },
  {
    key: "hundred_problems_solved",
    name: "100 Problems Solved",
    description: "Answer 100 problems correctly.",
  },
  {
    key: "perfect_session",
    name: "Perfect Session",
    description: "Finish a session with no misses.",
  },
  {
    key: "sub_5s_solve",
    name: "Sub-5s Solve",
    description: "Answer a problem correctly in under 5 seconds.",
  },
  {
    key: "master_of_a_group",
    name: "Master of a Group",
    description: "Reach mastery 80 or higher on every leaf in one chapter.",
  },
  {
    key: "race_demon",
    name: "Race Demon",
    description: "Set a Speed Multiplication Race personal best under the target threshold.",
  },
  {
    key: "comeback",
    name: "Comeback",
    description: "Win after being in last place before the final round.",
  },
] as const;

const MOCK_ACHIEVEMENTS: Record<string, string> = {
  first_win: daysAgoIso(12),
  sub_5s_solve: daysAgoIso(5),
  perfect_session: daysAgoIso(2),
};

const MOCK_MATCH_HISTORY: GuestMatchHistoryRow[] = [
  {
    id: "mock-solo-1",
    mode: "solo",
    played_at: daysAgoIso(1),
    title: "Ratios and Percents Drill",
    result: "practice",
    placement: 1,
    players: 1,
    score: 1420,
    correct: 9,
    total_rounds: 10,
    duration_ms: 9 * 60 * 1000 + 14 * 1000,
    rating_delta: null,
    topics: ["ch6.basic_ratio", "ch6.percent"],
  },
  {
    id: "mock-mp-1",
    mode: "mp",
    played_at: daysAgoIso(3),
    title: "Ranked Party Match",
    result: "win",
    placement: 1,
    players: 4,
    score: 1880,
    correct: 11,
    total_rounds: 12,
    duration_ms: 13 * 60 * 1000 + 2 * 1000,
    rating_delta: 18,
    topics: ["ch3.solving_linear_2", "ch5.elimination"],
  },
  {
    id: "mock-race-1",
    mode: "race",
    played_at: daysAgoIso(4),
    title: "Speed Multiplication Sprint",
    result: "complete",
    placement: 2,
    players: 3,
    score: 36,
    correct: 36,
    total_rounds: 40,
    duration_ms: 60 * 1000,
    rating_delta: null,
    topics: ["race.multiplication"],
  },
];

const MOCK_RACE_PERSONAL_BESTS: GuestRacePersonalBest[] = [
  {
    id: "mock-race-pb-sprint",
    mode: "sprint",
    label: "60s sprint, 2 to 12",
    config: { min_factor: 2, max_factor: 12, window_seconds: 60 },
    correct: 42,
    duration_ms: 60 * 1000,
    created_at: daysAgoIso(4),
  },
  {
    id: "mock-race-pb-first-to-n",
    mode: "first_to_n",
    label: "First to 20, 2 to 12",
    config: { min_factor: 2, max_factor: 12, target_correct: 20 },
    correct: 20,
    duration_ms: 53 * 1000 + 240,
    created_at: daysAgoIso(8),
  },
];

type StreakBlock = GuestProfile["streak"];

export function ProfileDashboard() {
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

  const hasTopicStats = Object.keys(profile.topic_stats).length > 0;
  const hasHistory = profile.match_history.length > 0;
  const hasRaceBests = profile.race_personal_bests.length > 0;
  const hasAchievements = Object.keys(profile.achievements).length > 0;
  const hasStreak = profile.streak.current > 0 || profile.streak.longest > 0 || Boolean(profile.streak.last_played_date);
  const supabaseReady = isSupabaseConfigured();
  const topicStats = hasTopicStats ? profile.topic_stats : buildMockTopicStats();
  const streak = hasStreak
    ? profile.streak
    : {
        current: 5,
        longest: 9,
        last_played_date: toDateKey(new Date()),
        freeze_tokens: 1,
      };
  const matchHistory = hasHistory ? profile.match_history : MOCK_MATCH_HISTORY;
  const raceBests = hasRaceBests ? profile.race_personal_bests : MOCK_RACE_PERSONAL_BESTS;
  const achievements = hasAchievements ? profile.achievements : MOCK_ACHIEVEMENTS;
  const usingPreviewRows = !hasTopicStats || !hasHistory || !hasRaceBests || !hasAchievements || !hasStreak;
  const totals = getTopicTotals(topicStats);
  const masteredGroups = getMasteredGroups(topicStats);

  return (
    <div className="flex flex-col gap-6">
      <section className="overflow-hidden rounded-[2rem] border border-amber-400/30 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.22),rgba(17,24,39,0.96)_36%,rgba(3,7,18,0.98)_100%)] shadow-2xl shadow-black/40">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_22rem] lg:p-8">
          <form onSubmit={submit} className="flex flex-col gap-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-ftw-accent">
                  Profile dashboard
                </p>
                <h1 className="mt-2 text-4xl font-black tracking-tight md:text-6xl">
                  {profile.display_name}
                </h1>
                <p className="mt-2 text-sm text-ftw-muted">@{profile.username}</p>
              </div>
              <div className="rounded-full border border-gray-700 bg-gray-950/70 px-4 py-2 text-sm text-ftw-muted">
                {supabaseReady ? "Supabase ready" : "Guest storage active"}
              </div>
            </div>

            {usingPreviewRows && (
              <div className="rounded-2xl border border-ftw-info/40 bg-ftw-info/10 px-4 py-3 text-sm leading-6 text-blue-100">
                Some dashboard sections are using local preview rows until sessions write profile stats.
                Saved identity and settings still use the existing guest_profile localStorage record.
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm text-ftw-muted">
                Username
                <input
                  value={profile.username}
                  onChange={(event) => updateProfile({ username: event.target.value })}
                  className="rounded-xl border border-gray-700 bg-gray-950/80 px-4 py-3 text-ftw-text outline-none transition focus:border-ftw-accent"
                  required
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-ftw-muted">
                Display name
                <input
                  value={profile.display_name}
                  onChange={(event) => updateProfile({ display_name: event.target.value })}
                  className="rounded-xl border border-gray-700 bg-gray-950/80 px-4 py-3 text-ftw-text outline-none transition focus:border-ftw-accent"
                  required
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-ftw-muted">
                Avatar URL
                <input
                  value={profile.avatar}
                  onChange={(event) => updateProfile({ avatar: event.target.value })}
                  className="rounded-xl border border-gray-700 bg-gray-950/80 px-4 py-3 text-ftw-text outline-none transition focus:border-ftw-accent"
                  placeholder="Storage URL later"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-ftw-muted">
                Title
                <input
                  value={profile.title}
                  onChange={(event) => updateProfile({ title: event.target.value })}
                  className="rounded-xl border border-gray-700 bg-gray-950/80 px-4 py-3 text-ftw-text outline-none transition focus:border-ftw-accent"
                />
              </label>
            </div>

            {saved && (
              <div className="rounded-xl border border-ftw-success/50 bg-ftw-success/10 px-4 py-3 text-sm text-green-100">
                Saved to local guest profile.
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button className="rounded-xl bg-ftw-accent px-5 py-3 font-black text-ftw-dark transition hover:bg-amber-300">
                Save Profile
              </button>
              <Link
                href="/settings"
                className="rounded-xl border border-gray-700 bg-gray-950/70 px-5 py-3 font-bold transition hover:border-ftw-text"
              >
                Settings
              </Link>
              <Link
                href="/claim"
                className="rounded-xl border border-ftw-info px-5 py-3 font-bold text-blue-100 transition hover:bg-ftw-info hover:text-white"
              >
                Claim Account
              </Link>
            </div>
          </form>

          <aside className="grid gap-3 rounded-3xl border border-gray-800 bg-gray-950/80 p-5">
            <Stat label="Rating" value={profile.rating.toString()} tone="accent" />
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Level" value={profile.level.toString()} />
              <Stat label="XP" value={profile.xp.toString()} />
              <Stat label="Current streak" value={streak.current.toString()} />
              <Stat label="Freeze tokens" value={`${streak.freeze_tokens}/2`} />
            </div>
            <div className="rounded-2xl border border-gray-800 bg-ftw-panel/80 p-4">
              <div className="text-sm font-bold uppercase tracking-[0.2em] text-ftw-muted">Mastery pulse</div>
              <div className="mt-3 text-3xl font-black text-ftw-success">{totals.average}%</div>
              <p className="mt-1 text-sm text-ftw-muted">
                {totals.attempted} of {totals.total} leaves have attempts. {masteredGroups.length} groups mastered.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]">
        <MasteryHeatmap topicStats={topicStats} masteredGroups={masteredGroups} />
        <div className="flex flex-col gap-6">
          <StreakPanel streak={streak} />
          <SettingsEntryPoint profile={profile} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <AchievementsPanel achievements={achievements} masteredGroupCount={masteredGroups.length} />
        <RacePersonalBestsPanel bests={raceBests} />
      </div>

      <MatchHistoryPanel rows={matchHistory} />
    </div>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "accent" }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-ftw-panel/90 p-4">
      <div className={tone === "accent" ? "text-4xl font-black text-ftw-accent" : "text-2xl font-black"}>
        {value}
      </div>
      <div className="mt-1 text-xs uppercase tracking-[0.2em] text-ftw-muted">{label}</div>
    </div>
  );
}

function MasteryHeatmap({
  topicStats,
  masteredGroups,
}: {
  topicStats: Record<string, GuestTopicStat>;
  masteredGroups: string[];
}) {
  return (
    <section className="rounded-[2rem] border border-gray-800 bg-ftw-panel p-5 shadow-xl lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-ftw-success">Mastery map</p>
          <h2 className="mt-2 text-3xl font-black">Taxonomy heatmap</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-ftw-muted">
          <Legend className="bg-gray-950" label="No data" />
          <Legend className="bg-orange-900" label="Building" />
          <Legend className="bg-amber-500" label="Solid" />
          <Legend className="bg-emerald-400" label="Mastery" />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {taxonomy.groups.map((group) => {
          const average = getGroupAverage(group.leaves, topicStats);
          const mastered = masteredGroups.includes(group.group_id);

          return (
            <div key={group.group_id} className="rounded-2xl border border-gray-800 bg-gray-950/80 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-black">{group.display_name}</div>
                  <div className="font-mono text-xs text-ftw-muted">{group.group_id}</div>
                </div>
                <div className="flex items-center gap-2">
                  {mastered && (
                    <span className="rounded-full bg-ftw-success px-3 py-1 text-xs font-black text-ftw-dark">
                      mastered
                    </span>
                  )}
                  <span className="rounded-full border border-gray-700 px-3 py-1 text-sm font-black text-ftw-accent">
                    {average}%
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
                {group.leaves.map((leaf) => {
                  const stat = topicStats[leaf.topic_id];
                  const mastery = clampMastery(stat?.mastery ?? 0);
                  const attempts = stat?.attempts ?? 0;

                  return (
                    <div
                      key={leaf.topic_id}
                      title={`${leaf.display_name}: ${mastery}% mastery, ${attempts} attempts`}
                      className={`flex aspect-square items-center justify-center rounded-xl border text-xs font-black shadow-inner ${masteryClass(mastery, attempts)}`}
                    >
                      {Math.round(mastery)}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-gray-800 bg-gray-950 px-3 py-1">
      <span className={`h-3 w-3 rounded ${className}`} />
      {label}
    </span>
  );
}

function StreakPanel({ streak }: { streak: StreakBlock }) {
  const days = getCalendarDays(35);
  const playedDays = getPlayedDays(streak);

  return (
    <section className="rounded-[2rem] border border-gray-800 bg-ftw-panel p-5 shadow-xl lg:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-ftw-accent">Streak</p>
          <h2 className="mt-2 text-3xl font-black">Calendar</h2>
        </div>
        <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-right">
          <div className="text-2xl font-black text-ftw-accent">{streak.freeze_tokens}/2</div>
          <div className="text-xs uppercase tracking-[0.2em] text-ftw-muted">Freeze tokens</div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-2">
        {days.map((day) => {
          const key = toDateKey(day);
          const played = playedDays.has(key);
          const today = key === toDateKey(new Date());

          return (
            <div
              key={key}
              title={key}
              className={`flex aspect-square items-center justify-center rounded-xl border text-xs font-black ${
                played
                  ? "border-ftw-success bg-ftw-success text-ftw-dark"
                  : today
                    ? "border-ftw-accent bg-ftw-accent/10 text-ftw-accent"
                    : "border-gray-800 bg-gray-950 text-gray-600"
              }`}
            >
              {day.getDate()}
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Stat label="Current" value={`${streak.current} days`} />
        <Stat label="Longest" value={`${streak.longest} days`} />
      </div>
      <p className="mt-4 text-sm leading-6 text-ftw-muted">
        Streaks count one completed session per local calendar day. Server finalize will evaluate this later to prevent clock spoofing.
      </p>
    </section>
  );
}

function SettingsEntryPoint({ profile }: { profile: GuestProfile }) {
  return (
    <section className="rounded-[2rem] border border-gray-800 bg-gray-950 p-5 shadow-xl lg:p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-ftw-info">Settings</p>
      <h2 className="mt-2 text-3xl font-black">Default setup</h2>
      <div className="mt-5 grid gap-3 text-sm">
        <SettingLine label="Theme" value={profile.settings.theme.replace("_", " ")} />
        <SettingLine label="LaTeX size" value={profile.settings.latex_size} />
        <SettingLine label="Default difficulty" value={profile.settings.default_difficulty} />
        <SettingLine label="Timezone" value={profile.settings.timezone} />
      </div>
      <Link
        href="/settings"
        className="mt-5 inline-flex rounded-xl bg-ftw-info px-5 py-3 font-black text-white transition hover:bg-blue-400"
      >
        Open Settings
      </Link>
    </section>
  );
}

function SettingLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-800 bg-ftw-panel px-4 py-3">
      <span className="text-ftw-muted">{label}</span>
      <span className="text-right font-bold capitalize">{value || "Not set"}</span>
    </div>
  );
}

function AchievementsPanel({ achievements, masteredGroupCount }: { achievements: Record<string, string>; masteredGroupCount: number }) {
  return (
    <section className="rounded-[2rem] border border-gray-800 bg-ftw-panel p-5 shadow-xl lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-ftw-accent">Achievements</p>
          <h2 className="mt-2 text-3xl font-black">Starter set</h2>
        </div>
        <div className="rounded-full border border-gray-700 px-3 py-1 text-sm font-black text-ftw-muted">
          {Object.keys(achievements).length}/{ACHIEVEMENTS.length} unlocked
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {ACHIEVEMENTS.map((achievement) => {
          const unlockedAt = achievements[achievement.key];

          return (
            <div
              key={achievement.key}
              className={`rounded-2xl border p-4 ${
                unlockedAt ? "border-ftw-success/60 bg-ftw-success/10" : "border-gray-800 bg-gray-950/80"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-black">{achievement.name}</div>
                <div className={unlockedAt ? "text-xs font-bold text-green-200" : "text-xs font-bold text-ftw-muted"}>
                  {unlockedAt ? `Unlocked ${formatDate(unlockedAt)}` : "Locked"}
                </div>
              </div>
              <p className="mt-2 text-sm leading-6 text-ftw-muted">{achievement.description}</p>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-sm text-ftw-muted">Mastered groups detected from heatmap: {masteredGroupCount}</p>
    </section>
  );
}

function RacePersonalBestsPanel({ bests }: { bests: GuestRacePersonalBest[] }) {
  return (
    <section className="rounded-[2rem] border border-gray-800 bg-ftw-panel p-5 shadow-xl lg:p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-ftw-success">Race</p>
      <h2 className="mt-2 text-3xl font-black">Personal bests</h2>
      <div className="mt-5 grid gap-3">
        {bests.map((best) => (
          <div key={best.id} className="rounded-2xl border border-gray-800 bg-gray-950/80 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-black">{best.label}</div>
                <div className="text-sm capitalize text-ftw-muted">{best.mode.replaceAll("_", " ")}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-ftw-success">{best.correct}</div>
                <div className="text-xs uppercase tracking-[0.2em] text-ftw-muted">correct</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-ftw-panel p-3">
                <div className="font-black">{formatDuration(best.duration_ms)}</div>
                <div className="text-ftw-muted">Duration</div>
              </div>
              <div className="rounded-xl bg-ftw-panel p-3">
                <div className="font-black">{formatDate(best.created_at)}</div>
                <div className="text-ftw-muted">Set on</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MatchHistoryPanel({ rows }: { rows: GuestMatchHistoryRow[] }) {
  return (
    <section className="rounded-[2rem] border border-gray-800 bg-ftw-panel p-5 shadow-xl lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-ftw-info">History</p>
          <h2 className="mt-2 text-3xl font-black">Recent sessions</h2>
        </div>
        <Link href="/solo" className="rounded-xl border border-gray-700 px-4 py-2 text-sm font-bold hover:border-ftw-text">
          Play Solo
        </Link>
      </div>

      <div className="mt-5 grid gap-3">
        {rows.map((row) => (
          <article key={row.id} className="rounded-2xl border border-gray-800 bg-gray-950/80 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-gray-700 px-3 py-1 text-xs font-black uppercase text-ftw-muted">
                    {row.mode}
                  </span>
                  <span className={resultClass(row.result)}>{row.result}</span>
                </div>
                <h3 className="mt-3 text-xl font-black">{row.title}</h3>
                <div className="mt-1 text-sm text-ftw-muted">{formatDate(row.played_at)}</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black text-ftw-accent">{row.score}</div>
                <div className="text-xs uppercase tracking-[0.2em] text-ftw-muted">score</div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <HistoryMetric label="Accuracy" value={`${row.correct}/${row.total_rounds}`} />
              <HistoryMetric label="Duration" value={formatDuration(row.duration_ms)} />
              <HistoryMetric label="Placement" value={formatPlacement(row)} />
              <HistoryMetric label="Rating" value={row.rating_delta === null ? "N/A" : signedNumber(row.rating_delta)} />
            </div>
            {row.topics.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {row.topics.map((topic) => (
                  <span key={topic} className="rounded-full bg-ftw-panel px-3 py-1 font-mono text-xs text-ftw-muted">
                    {topic}
                  </span>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function HistoryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-ftw-panel p-3">
      <div className="font-black">{value}</div>
      <div className="text-xs uppercase tracking-[0.2em] text-ftw-muted">{label}</div>
    </div>
  );
}

function buildMockTopicStats(): Record<string, GuestTopicStat> {
  const entries = taxonomy.groups.flatMap((group, groupIndex) =>
    group.leaves.map((leaf, leafIndex) => {
      const mastery = 24 + ((groupIndex * 19 + leafIndex * 13) % 70);
      const attempts = 4 + ((groupIndex + leafIndex) % 12);
      const correct = Math.round((attempts * mastery) / 100);

      return [
        leaf.topic_id,
        {
          attempts,
          correct,
          avg_time_ms: 9000 + ((groupIndex + 1) * (leafIndex + 3) * 731) % 38000,
          mastery,
        },
      ] as const;
    })
  );

  return Object.fromEntries(entries);
}

function getTopicTotals(topicStats: Record<string, GuestTopicStat>) {
  const leaves = taxonomy.groups.flatMap((group) => group.leaves);
  const attempted = leaves.filter((leaf) => (topicStats[leaf.topic_id]?.attempts ?? 0) > 0);
  const average = attempted.length
    ? Math.round(attempted.reduce((sum, leaf) => sum + clampMastery(topicStats[leaf.topic_id]?.mastery ?? 0), 0) / attempted.length)
    : 0;

  return { average, attempted: attempted.length, total: leaves.length };
}

function getMasteredGroups(topicStats: Record<string, GuestTopicStat>): string[] {
  return taxonomy.groups
    .filter((group) => group.leaves.every((leaf) => clampMastery(topicStats[leaf.topic_id]?.mastery ?? 0) >= 80))
    .map((group) => group.group_id);
}

function getGroupAverage(leaves: (typeof taxonomy.groups)[number]["leaves"], topicStats: Record<string, GuestTopicStat>) {
  if (leaves.length === 0) {
    return 0;
  }

  return Math.round(
    leaves.reduce((sum, leaf) => sum + clampMastery(topicStats[leaf.topic_id]?.mastery ?? 0), 0) / leaves.length
  );
}

function masteryClass(mastery: number, attempts: number): string {
  if (attempts === 0) {
    return "border-gray-800 bg-gray-950 text-gray-500";
  }
  if (mastery >= 80) {
    return "border-emerald-300/80 bg-emerald-400 text-ftw-dark";
  }
  if (mastery >= 65) {
    return "border-lime-300/70 bg-lime-500/80 text-ftw-dark";
  }
  if (mastery >= 40) {
    return "border-amber-300/70 bg-amber-500/70 text-ftw-dark";
  }
  return "border-orange-500/50 bg-orange-900/70 text-orange-100";
}

function clampMastery(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getCalendarDays(count: number): Date[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (count - index - 1));
    return date;
  });
}

function getPlayedDays(streak: StreakBlock): Set<string> {
  const played = new Set<string>();
  if (!streak.last_played_date || streak.current <= 0) {
    return played;
  }

  const cursor = new Date(`${streak.last_played_date}T12:00:00`);
  for (let index = 0; index < streak.current; index += 1) {
    const day = new Date(cursor);
    day.setDate(cursor.getDate() - index);
    played.add(toDateKey(day));
  }

  return played;
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function formatDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    return "0s";
  }

  const totalSeconds = Math.round(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function resultClass(result: GuestMatchHistoryRow["result"]): string {
  if (result === "win") {
    return "rounded-full bg-ftw-success px-3 py-1 text-xs font-black uppercase text-ftw-dark";
  }
  if (result === "loss") {
    return "rounded-full bg-ftw-danger px-3 py-1 text-xs font-black uppercase text-white";
  }
  return "rounded-full bg-ftw-info px-3 py-1 text-xs font-black uppercase text-white";
}

function formatPlacement(row: GuestMatchHistoryRow): string {
  if (row.placement === null || row.players === null) {
    return "N/A";
  }

  return `${row.placement}/${row.players}`;
}

function signedNumber(value: number): string {
  return value > 0 ? `+${value}` : value.toString();
}
