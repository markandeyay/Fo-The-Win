"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import taxonomy from "@/content/taxonomy.json";
import {
  createDefaultGuestProfile,
  ensureGuestProfile,
  saveGuestProfile,
  type GuestMatchHistoryRow,
  type GuestProfile,
  type GuestRacePersonalBest,
  type GuestTopicStat,
} from "@/lib/guestProfile";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabaseClient";

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

type StreakBlock = GuestProfile["streak"];

type SupabaseClient = NonNullable<ReturnType<typeof getSupabaseBrowserClient>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeSettings(value: unknown, timezone: string): GuestProfile["settings"] {
  const fallback = createDefaultGuestProfile().settings;
  const settings = isRecord(value) ? value : {};
  return {
    ...fallback,
    sound: typeof settings.sound === "boolean" ? settings.sound : fallback.sound,
    latex_size:
      settings.latex_size === "small" || settings.latex_size === "large" || settings.latex_size === "medium"
        ? settings.latex_size
        : fallback.latex_size,
    default_topic_id: stringValue(settings.default_topic_id, fallback.default_topic_id),
    default_difficulty:
      settings.default_difficulty === "medium" || settings.default_difficulty === "hard" || settings.default_difficulty === "easy"
        ? settings.default_difficulty
        : fallback.default_difficulty,
    timezone,
  };
}

async function loadSupabaseProfile(supabase: SupabaseClient, userId: string): Promise<GuestProfile | null> {
  const [profileResult, streakResult, topicStatsResult, achievementsResult, raceScoresResult, sessionPlayersResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar, title, rating, xp, level, timezone, settings, created_at")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("streaks")
      .select("current_streak, longest_streak, last_played_date, freeze_tokens")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("user_topic_stats")
      .select("topic_id, attempts, correct, avg_time_ms, mastery")
      .eq("user_id", userId),
    supabase
      .from("user_achievements")
      .select("achievement_key, unlocked_at")
      .eq("user_id", userId),
    supabase
      .from("race_scores")
      .select("id, mode, config, correct, duration_ms, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("session_players")
      .select("session_id, score, correct_count, total_time_ms, placement, game_sessions(mode, ranked, config, created_at, ended_at)")
      .eq("user_id", userId)
      .order("session_id", { ascending: false }),
  ]);

  if (profileResult.error || !profileResult.data) {
    return null;
  }

  const row = profileResult.data;
  const timezone = stringValue(row.timezone, "UTC");
  const defaultProfile = createDefaultGuestProfile();

  return {
    ...defaultProfile,
    id: stringValue(row.id, userId),
    username: stringValue(row.username, defaultProfile.username),
    display_name: stringValue(row.display_name, stringValue(row.username, defaultProfile.display_name)),
    avatar: stringValue(row.avatar),
    title: stringValue(row.title),
    created_at: stringValue(row.created_at, defaultProfile.created_at),
    xp: numberValue(row.xp, 0),
    level: numberValue(row.level, 1),
    rating: numberValue(row.rating, 1200),
    streak: mapStreak(streakResult.data),
    topic_stats: mapTopicStats(topicStatsResult.data),
    settings: normalizeSettings(row.settings, timezone),
    match_history: mapMatchHistory(sessionPlayersResult.data),
    race_personal_bests: mapRaceScores(raceScoresResult.data),
    achievements: mapAchievements(achievementsResult.data),
  };
}

function mapStreak(value: unknown): StreakBlock {
  const row = isRecord(value) ? value : {};
  return {
    current: numberValue(row.current_streak, 0),
    longest: numberValue(row.longest_streak, 0),
    last_played_date: typeof row.last_played_date === "string" ? row.last_played_date : null,
    freeze_tokens: numberValue(row.freeze_tokens, 0),
  };
}

function mapTopicStats(value: unknown): Record<string, GuestTopicStat> {
  if (!Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    value.filter(isRecord).map((row) => [
      stringValue(row.topic_id),
      {
        attempts: numberValue(row.attempts, 0),
        correct: numberValue(row.correct, 0),
        avg_time_ms: numberValue(row.avg_time_ms, 0),
        mastery: numberValue(row.mastery, 0),
      },
    ])
  );
}

function mapAchievements(value: unknown): Record<string, string> {
  if (!Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    value
      .filter(isRecord)
      .map((row) => [stringValue(row.achievement_key), stringValue(row.unlocked_at)])
      .filter(([key, unlockedAt]) => key && unlockedAt)
  );
}

function mapRaceScores(value: unknown): GuestRacePersonalBest[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord).map((row) => {
    const mode = row.mode === "first_to_n" ? "first_to_n" : "sprint";
    const config = isRecord(row.config) ? (row.config as Record<string, string | number | boolean>) : {};
    return {
      id: String(row.id ?? "race-score"),
      mode,
      label: raceScoreLabel(mode, config),
      config,
      correct: numberValue(row.correct, 0),
      duration_ms: numberValue(row.duration_ms, 0),
      created_at: stringValue(row.created_at, new Date(0).toISOString()),
    };
  });
}

function raceScoreLabel(mode: GuestRacePersonalBest["mode"], config: Record<string, string | number | boolean>) {
  const min = numberValue(config.min_factor ?? config.minFactor, 2);
  const max = numberValue(config.max_factor ?? config.maxFactor, 12);
  const target = numberValue(config.target_correct ?? config.targetCorrect, 20);
  const seconds = numberValue(config.window_seconds ?? config.durationSec, 60);
  return mode === "first_to_n" ? `First to ${target}, ${min} to ${max}` : `${seconds}s sprint, ${min} to ${max}`;
}

function mapMatchHistory(value: unknown): GuestMatchHistoryRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord).map((row, index) => {
    const session = Array.isArray(row.game_sessions) ? row.game_sessions[0] : row.game_sessions;
    const sessionRecord = isRecord(session) ? session : {};
    const config = isRecord(sessionRecord.config) ? sessionRecord.config : {};
    const mode = sessionRecord.mode === "mp" || sessionRecord.mode === "race" ? sessionRecord.mode : "solo";
    const placement = typeof row.placement === "number" ? row.placement : null;
    const players = numberValue(config.player_count ?? config.players, mode === "solo" ? 1 : 0) || null;

    return {
      id: stringValue(row.session_id, `session-${index + 1}`),
      mode,
      played_at: stringValue(sessionRecord.ended_at, stringValue(sessionRecord.created_at, new Date(0).toISOString())),
      title: mode === "race" ? "Speed Race" : mode === "mp" ? "Multiplayer Match" : "Solo Session",
      result: mode === "race" ? "complete" : placement === 1 ? "win" : placement ? "loss" : "practice",
      placement,
      players,
      score: numberValue(row.score, 0),
      correct: numberValue(row.correct_count, 0),
      total_rounds: numberValue(config.roundCount ?? config.rounds, 0),
      duration_ms: numberValue(row.total_time_ms, 0),
      rating_delta: null,
      topics: Array.isArray(config.topicIds) ? config.topicIds.filter((topic): topic is string => typeof topic === "string") : [],
    };
  });
}

export function ProfileDashboard() {
  const [profile, setProfile] = useState<GuestProfile | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        const userId = data.session?.user.id;
        if (userId) {
          const remoteProfile = await loadSupabaseProfile(supabase, userId);
          if (!cancelled && remoteProfile) {
            setProfile(remoteProfile);
            return;
          }
        }
      }

      if (!cancelled) {
        setProfile(ensureGuestProfile());
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
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
  const topicStats = profile.topic_stats;
  const streak = profile.streak;
  const matchHistory = profile.match_history;
  const raceBests = profile.race_personal_bests;
  const achievements = profile.achievements;
  const totals = getTopicTotals(topicStats);
  const masteredGroups = getMasteredGroups(topicStats);
  const gamesPlayed = matchHistory.length + raceBests.length;
  const correctCount =
    matchHistory.reduce((sum, row) => sum + row.correct, 0) +
    raceBests.reduce((sum, row) => sum + row.correct, 0);

  return (
    <div className="flex flex-col gap-6">
      <section className="ftw-card overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_22rem] lg:p-8">
          <form onSubmit={submit} className="flex flex-col gap-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="ftw-label text-ftw-accent">
                  Profile dashboard
                </p>
                <h1 className="ftw-display mt-2 text-4xl md:text-6xl">
                  {profile.display_name}
                </h1>
                <p className="mt-2 text-sm text-ftw-muted">@{profile.username}</p>
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
              <div className="rounded-xl border border-ftw-success/50 bg-ftw-success/10 px-4 py-3 text-sm text-ftw-success">
                Saved to local guest profile.
              </div>
            )}

            <div className="flex flex-wrap gap-3">
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

          <aside className="grid gap-3 rounded-ftw border border-ftw-line bg-ftw-canvas p-5 shadow-ftw-sm">
            <Stat label="Rating" value={profile.rating.toString()} tone="accent" />
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Level" value={profile.level.toString()} />
              <Stat label="XP" value={profile.xp.toString()} />
              <Stat label="Games played" value={gamesPlayed.toString()} />
              <Stat label="Correct" value={correctCount.toString()} />
              <Stat label="Current streak" value={streak.current.toString()} />
              <Stat label="Freeze tokens" value={`${streak.freeze_tokens}/2`} />
            </div>
            <div className="ftw-card-sm p-4">
              <div className="ftw-label text-ftw-muted">Mastery pulse</div>
              <div className="ftw-number mt-3 text-3xl text-ftw-success">{totals.average}%</div>
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
    <div className="ftw-card-sm p-4">
      <div className={tone === "accent" ? "ftw-number text-4xl text-ftw-accent" : "ftw-number text-2xl"}>
        {value}
      </div>
      <div className="ftw-label mt-1 text-ftw-muted">{label}</div>
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
    <section className="ftw-card p-5 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="ftw-label text-ftw-success">Mastery map</p>
          <h2 className="mt-2 font-serif text-3xl font-black">Taxonomy heatmap</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-ftw-muted">
          <Legend className="bg-ftw-line" label="Unfamiliar" />
          <Legend className="bg-ftw-accent" label="Building" />
          <Legend className="bg-ftw-warning" label="Solid" />
          <Legend className="bg-ftw-success" label="Mastery" />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {taxonomy.groups.map((group) => {
          const average = getGroupAverage(group.leaves, topicStats);
          const mastered = masteredGroups.includes(group.group_id);

          return (
            <div key={group.group_id} className="ftw-card-muted p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-black">{group.display_name}</div>
                  <div className="font-mono text-xs text-ftw-muted">{group.group_id}</div>
                </div>
                <div className="flex items-center gap-2">
                  {mastered && (
                    <span className="rounded-full bg-ftw-success px-3 py-1 text-xs font-black text-ftw-panel">
                      mastered
                    </span>
                  )}
                  <span className="rounded-full border border-ftw-line bg-ftw-raised px-3 py-1 text-sm font-black text-ftw-accent">
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
    <span className="inline-flex items-center gap-2 rounded-full border border-ftw-line bg-ftw-canvas px-3 py-1">
      <span className={`h-3 w-3 rounded ${className}`} />
      {label}
    </span>
  );
}

function StreakPanel({ streak }: { streak: StreakBlock }) {
  const days = getCalendarDays(35);
  const playedDays = getPlayedDays(streak);

  return (
    <section className="ftw-card p-5 lg:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="ftw-label text-ftw-accent">Streak</p>
          <h2 className="mt-2 font-serif text-3xl font-black">Calendar</h2>
        </div>
        <div className="rounded-ftw-sm border border-ftw-accent/40 bg-ftw-accent/10 px-4 py-3 text-right">
          <div className="ftw-number text-2xl text-ftw-accent">{streak.freeze_tokens}/2</div>
          <div className="ftw-label text-ftw-muted">Freeze tokens</div>
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
                  ? "border-ftw-success bg-ftw-success text-ftw-panel"
                  : today
                    ? "border-ftw-accent bg-ftw-accent/10 text-ftw-accent"
                    : "border-ftw-line bg-ftw-canvas text-ftw-muted"
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
      {streak.current === 0 && streak.longest === 0 && !streak.last_played_date && (
        <p className="mt-3 rounded-xl border border-ftw-line bg-ftw-canvas px-4 py-3 text-sm text-ftw-muted">
          No completed sessions yet. Your streak starts after your first finalized session.
        </p>
      )}
    </section>
  );
}

function SettingsEntryPoint({ profile }: { profile: GuestProfile }) {
  return (
    <section className="ftw-card p-5 lg:p-6">
      <p className="ftw-label text-ftw-info">Settings</p>
      <h2 className="mt-2 font-serif text-3xl font-black">Default setup</h2>
      <div className="mt-5 grid gap-3 text-sm">
        <SettingLine label="LaTeX size" value={profile.settings.latex_size} />
        <SettingLine label="Default difficulty" value={profile.settings.default_difficulty} />
        <SettingLine label="Timezone" value={profile.settings.timezone} />
      </div>
      <Link
        href="/settings"
        className="mt-5 inline-flex rounded-xl border border-ftw-info bg-ftw-info/10 px-5 py-3 font-black text-ftw-info transition hover:bg-ftw-info hover:text-ftw-panel"
      >
        Open Settings
      </Link>
    </section>
  );
}

function SettingLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-ftw-line bg-ftw-raised px-4 py-3">
      <span className="text-ftw-muted">{label}</span>
      <span className="text-right font-bold capitalize">{value || "Not set"}</span>
    </div>
  );
}

function AchievementsPanel({ achievements, masteredGroupCount }: { achievements: Record<string, string>; masteredGroupCount: number }) {
  return (
    <section className="ftw-card p-5 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="ftw-label text-ftw-accent">Achievements</p>
          <h2 className="mt-2 font-serif text-3xl font-black">Starter set</h2>
        </div>
        <div className="ftw-chip text-sm">
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
                unlockedAt ? "border-ftw-success/60 bg-ftw-success/10" : "border-ftw-line bg-ftw-canvas"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-black">{achievement.name}</div>
                <div className={unlockedAt ? "text-xs font-bold text-ftw-success" : "text-xs font-bold text-ftw-muted"}>
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
    <section className="ftw-card p-5 lg:p-6">
      <p className="ftw-label text-ftw-success">Race</p>
      <h2 className="mt-2 font-serif text-3xl font-black">Personal bests</h2>
      <div className="mt-5 grid gap-3">
        {bests.length === 0 && (
          <EmptyState title="No race bests yet" description="Run a solo speed race to create your first real personal best." />
        )}
        {bests.map((best) => (
          <div key={best.id} className="ftw-card-muted p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-black">{best.label}</div>
                <div className="text-sm capitalize text-ftw-muted">{best.mode.replaceAll("_", " ")}</div>
              </div>
              <div className="text-right">
                <div className="ftw-number text-2xl text-ftw-success">{best.correct}</div>
                <div className="ftw-label text-ftw-muted">correct</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-ftw-line bg-ftw-raised p-3">
                <div className="font-black">{formatDuration(best.duration_ms)}</div>
                <div className="text-ftw-muted">Duration</div>
              </div>
              <div className="rounded-xl border border-ftw-line bg-ftw-raised p-3">
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
    <section className="ftw-card p-5 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="ftw-label text-ftw-info">History</p>
          <h2 className="mt-2 font-serif text-3xl font-black">Recent sessions</h2>
        </div>
        <Link href="/solo" className="ftw-button-secondary px-4 py-2 text-sm">
          Play Solo
        </Link>
      </div>

      <div className="mt-5 grid gap-3">
        {rows.length === 0 && (
          <EmptyState title="No sessions yet" description="Play a solo session or finalized match to populate real history here." />
        )}
        {rows.map((row) => (
          <article key={row.id} className="ftw-card-muted p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="ftw-chip uppercase">
                    {row.mode}
                  </span>
                  <span className={resultClass(row.result)}>{row.result}</span>
                </div>
                <h3 className="mt-3 text-xl font-black">{row.title}</h3>
                <div className="mt-1 text-sm text-ftw-muted">{formatDate(row.played_at)}</div>
              </div>
              <div className="text-right">
                <div className="ftw-number text-3xl text-ftw-accent">{row.score}</div>
                <div className="ftw-label text-ftw-muted">score</div>
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
                  <span key={topic} className="rounded-full border border-ftw-line bg-ftw-panel px-3 py-1 font-mono text-xs text-ftw-muted">
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

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-ftw-line bg-ftw-canvas p-5 text-sm text-ftw-muted">
      <div className="font-bold text-ftw-text">{title}</div>
      <p className="mt-1 leading-6">{description}</p>
    </div>
  );
}

function HistoryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ftw-line bg-ftw-raised p-3">
      <div className="ftw-number">{value}</div>
      <div className="ftw-label text-ftw-muted">{label}</div>
    </div>
  );
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
    return "border-ftw-line bg-ftw-canvas text-ftw-muted";
  }
  if (mastery >= 80) {
    return "border-ftw-success bg-ftw-success text-ftw-panel";
  }
  if (mastery >= 65) {
    return "border-ftw-success bg-ftw-success/60 text-ftw-text";
  }
  if (mastery >= 40) {
    return "border-ftw-warning bg-ftw-warning/60 text-ftw-text";
  }
  return "border-ftw-accent bg-ftw-accent/25 text-ftw-accent";
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
    return "rounded-full bg-ftw-success px-3 py-1 text-xs font-black uppercase text-ftw-panel";
  }
  if (result === "loss") {
    return "rounded-full bg-ftw-danger px-3 py-1 text-xs font-black uppercase text-ftw-panel";
  }
  return "rounded-full bg-ftw-info px-3 py-1 text-xs font-black uppercase text-ftw-panel";
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
