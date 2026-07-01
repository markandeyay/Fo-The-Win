export const GUEST_PROFILE_KEY = "guest_profile";

export type FtwTheme = "system" | "dark" | "high_contrast";
export type FtwDifficulty = "easy" | "medium" | "hard";

export type GuestTopicStat = {
  attempts: number;
  correct: number;
  avg_time_ms: number;
  mastery: number;
};

export type GuestMatchHistoryRow = {
  id: string;
  mode: "solo" | "mp" | "race";
  played_at: string;
  title: string;
  result: "win" | "loss" | "practice" | "complete";
  placement: number | null;
  players: number | null;
  score: number;
  correct: number;
  total_rounds: number;
  duration_ms: number;
  rating_delta: number | null;
  topics: string[];
};

export type GuestRacePersonalBest = {
  id: string;
  mode: "sprint" | "first_to_n";
  label: string;
  config: Record<string, string | number | boolean>;
  correct: number;
  duration_ms: number;
  created_at: string;
};

export type GuestProfileSettings = {
  sound: boolean;
  theme: FtwTheme;
  latex_size: "small" | "medium" | "large";
  default_topic_id: string;
  default_difficulty: FtwDifficulty;
  timezone: string;
};

export type GuestProfile = {
  id: string;
  username: string;
  display_name: string;
  avatar: string;
  title: string;
  created_at: string;
  xp: number;
  level: number;
  rating: number;
  streak: {
    current: number;
    longest: number;
    last_played_date: string | null;
    freeze_tokens: number;
  };
  topic_stats: Record<string, GuestTopicStat>;
  settings: GuestProfileSettings;
  match_history: GuestMatchHistoryRow[];
  race_personal_bests: GuestRacePersonalBest[];
  achievements: Record<string, string>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nullableNumberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeMatchHistory(value: unknown): GuestMatchHistoryRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord).map((row, index) => {
    const mode = row.mode === "mp" || row.mode === "race" ? row.mode : "solo";
    const result =
      row.result === "win" || row.result === "loss" || row.result === "practice"
        ? row.result
        : "complete";

    return {
      id: stringValue(row.id, `local-match-${index + 1}`),
      mode,
      played_at: stringValue(row.played_at, new Date().toISOString()),
      title: stringValue(row.title, mode === "race" ? "Speed Race" : "Practice Session"),
      result,
      placement: nullableNumberValue(row.placement),
      players: nullableNumberValue(row.players),
      score: numberValue(row.score, 0),
      correct: numberValue(row.correct, 0),
      total_rounds: numberValue(row.total_rounds, 0),
      duration_ms: numberValue(row.duration_ms, 0),
      rating_delta: nullableNumberValue(row.rating_delta),
      topics: Array.isArray(row.topics) ? row.topics.filter((topic): topic is string => typeof topic === "string") : [],
    };
  });
}

function normalizeRacePersonalBests(value: unknown): GuestRacePersonalBest[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord).map((row, index) => {
    const mode = row.mode === "first_to_n" ? "first_to_n" : "sprint";

    return {
      id: stringValue(row.id, `local-race-pb-${index + 1}`),
      mode,
      label: stringValue(row.label, mode === "first_to_n" ? "First to N" : "Sprint"),
      config: isRecord(row.config) ? (row.config as Record<string, string | number | boolean>) : {},
      correct: numberValue(row.correct, 0),
      duration_ms: numberValue(row.duration_ms, 0),
      created_at: stringValue(row.created_at, new Date().toISOString()),
    };
  });
}

function normalizeTopicStats(value: unknown): Record<string, GuestTopicStat> {
  if (!isRecord(value)) {
    return {};
  }

  const stats: Record<string, GuestTopicStat> = {};

  for (const [topicId, stat] of Object.entries(value)) {
    if (!isRecord(stat)) {
      continue;
    }
    const statRecord = stat;

    stats[topicId] = {
      attempts: numberValue(statRecord.attempts, 0),
      correct: numberValue(statRecord.correct, 0),
      avg_time_ms: numberValue(statRecord.avg_time_ms, 0),
      mastery: numberValue(statRecord.mastery, 0),
    };
  }

  return stats;
}

function normalizeGuestProfile(value: unknown): GuestProfile | null {
  if (!isRecord(value)) {
    return null;
  }

  const fallback = createDefaultGuestProfile();
  const streak = isRecord(value.streak) ? value.streak : {};
  const settings = isRecord(value.settings) ? value.settings : {};
  const achievements = isRecord(value.achievements)
    ? Object.fromEntries(
        Object.entries(value.achievements).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string"
        )
      )
    : {};

  return {
    ...fallback,
    id: stringValue(value.id, fallback.id),
    username: stringValue(value.username, fallback.username),
    display_name: stringValue(value.display_name, fallback.display_name),
    avatar: stringValue(value.avatar, fallback.avatar),
    title: stringValue(value.title, fallback.title),
    created_at: stringValue(value.created_at, fallback.created_at),
    xp: numberValue(value.xp, fallback.xp),
    level: numberValue(value.level, fallback.level),
    rating: numberValue(value.rating, fallback.rating),
    streak: {
      current: numberValue(streak.current, fallback.streak.current),
      longest: numberValue(streak.longest, fallback.streak.longest),
      last_played_date: typeof streak.last_played_date === "string" ? streak.last_played_date : null,
      freeze_tokens: numberValue(streak.freeze_tokens, fallback.streak.freeze_tokens),
    },
    topic_stats: normalizeTopicStats(value.topic_stats),
    settings: {
      sound: typeof settings.sound === "boolean" ? settings.sound : fallback.settings.sound,
      theme:
        settings.theme === "system" || settings.theme === "high_contrast" || settings.theme === "dark"
          ? settings.theme
          : fallback.settings.theme,
      latex_size:
        settings.latex_size === "small" || settings.latex_size === "large" || settings.latex_size === "medium"
          ? settings.latex_size
          : fallback.settings.latex_size,
      default_topic_id: stringValue(settings.default_topic_id, fallback.settings.default_topic_id),
      default_difficulty:
        settings.default_difficulty === "medium" || settings.default_difficulty === "hard" || settings.default_difficulty === "easy"
          ? settings.default_difficulty
          : fallback.settings.default_difficulty,
      timezone: stringValue(settings.timezone, fallback.settings.timezone),
    },
    match_history: normalizeMatchHistory(value.match_history),
    race_personal_bests: normalizeRacePersonalBests(value.race_personal_bests),
    achievements,
  };
}

function fallbackTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function makeGuestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createDefaultGuestProfile(): GuestProfile {
  const shortId = Math.random().toString(36).slice(2, 8);

  return {
    id: makeGuestId(),
    username: `guest_${shortId}`,
    display_name: "Guest Player",
    avatar: "",
    title: "Local Challenger",
    created_at: new Date().toISOString(),
    xp: 0,
    level: 1,
    rating: 1200,
    streak: {
      current: 0,
      longest: 0,
      last_played_date: null,
      freeze_tokens: 0,
    },
    topic_stats: {},
    settings: {
      sound: true,
      theme: "dark",
      latex_size: "medium",
      default_topic_id: "",
      default_difficulty: "easy",
      timezone: fallbackTimezone(),
    },
    match_history: [],
    race_personal_bests: [],
    achievements: {},
  };
}

export function loadGuestProfile(): GuestProfile | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawProfile = window.localStorage.getItem(GUEST_PROFILE_KEY);
  if (!rawProfile) {
    return null;
  }

  try {
    return normalizeGuestProfile(JSON.parse(rawProfile));
  } catch {
    window.localStorage.removeItem(GUEST_PROFILE_KEY);
    return null;
  }
}

export function saveGuestProfile(profile: GuestProfile): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(profile));
}

export function ensureGuestProfile(): GuestProfile {
  const existing = loadGuestProfile();
  if (existing) {
    return existing;
  }

  const profile = createDefaultGuestProfile();
  saveGuestProfile(profile);
  return profile;
}

export function clearGuestProfile(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(GUEST_PROFILE_KEY);
}
