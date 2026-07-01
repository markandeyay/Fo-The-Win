"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "./supabaseClient";

export type Difficulty = "easy" | "medium" | "hard";

export interface MatchConfig {
  topicIds: string[];
  difficulty: Difficulty;
  roundCount: 5 | 10 | 20;
  ranked: boolean;
  timerMode: "per_problem" | "fixed";
  fixedDurationSec: 25 | 45 | 75;
  firstSolveBonus: boolean;
}

export interface PartyPresence {
  user_id: string;
  display_name: string;
  avatar?: string;
  ready: boolean;
  is_host: boolean;
}

export interface RoundProblemProjection {
  id: string;
  prompt_latex: string;
  answer_format: "mc" | "numeric" | "exact";
  choices?: { id: string; latex: string }[];
  topic_id?: string;
  group_id?: string;
  difficulty?: Difficulty;
  duration_ms?: number;
}

export type PartyBroadcastEvent =
  | { event: "lobby_update"; payload: { roster?: PartyPresence[]; reason?: string } }
  | { event: "config_update"; payload: MatchConfig }
  | { event: "game_start"; payload: { session_id: string; round_count: number } }
  | {
      event: "round_start";
      payload: {
        round_index: number;
        problem: RoundProblemProjection;
        server_start_ts: string;
        duration_ms: number;
      };
    }
  | { event: "answer_ack"; payload: { accepted: boolean; time_ms: number } }
  | {
      event: "round_reveal";
      payload: {
        correct_answer: string;
        solution: string;
        per_player_results: unknown[];
        scoreboard: unknown[];
      };
    }
  | {
      event: "game_end";
      payload: {
        final_scoreboard: unknown[];
        rating_delta?: unknown;
        xp_delta?: unknown;
        streak_delta?: unknown;
      };
    };

interface UsePartyRealtimeArgs {
  code: string;
  localPlayer: PartyPresence;
  initialConfig: MatchConfig;
}

interface StartRequestResult {
  ok: boolean;
  reason: string;
}

type PresenceState = Record<string, PartyPresence[]>;

function rosterFromPresenceState(state: PresenceState, fallback: PartyPresence) {
  const byUser = new Map<string, PartyPresence>();
  for (const presences of Object.values(state)) {
    for (const presence of presences) {
      if (presence.user_id) byUser.set(presence.user_id, presence);
    }
  }

  if (!byUser.has(fallback.user_id)) byUser.set(fallback.user_id, fallback);

  return Array.from(byUser.values()).sort((a, b) => {
    if (a.is_host !== b.is_host) return a.is_host ? -1 : 1;
    return a.display_name.localeCompare(b.display_name);
  });
}

export function usePartyRealtime({
  code,
  localPlayer,
  initialConfig,
}: UsePartyRealtimeArgs) {
  const normalizedCode = useMemo(() => code.trim().toUpperCase(), [code]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const presenceRef = useRef(localPlayer);
  const configRef = useRef(initialConfig);
  const [roster, setRoster] = useState<PartyPresence[]>([localPlayer]);
  const [config, setConfigState] = useState(initialConfig);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(
    isSupabaseConfigured() ? "Connecting" : "Local scaffold mode"
  );
  const [lastEvent, setLastEvent] = useState<PartyBroadcastEvent | null>(null);

  useEffect(() => {
    presenceRef.current = localPlayer;
    setRoster((current) =>
      current.map((player) =>
        player.user_id === localPlayer.user_id ? localPlayer : player
      )
    );
    if (channelRef.current && isConnected) void channelRef.current.track(localPlayer);
  }, [isConnected, localPlayer]);

  useEffect(() => {
    configRef.current = initialConfig;
    setConfigState(initialConfig);
  }, [initialConfig]);

  useEffect(() => {
    if (!normalizedCode) return;

    const client = getSupabaseBrowserClient();
    if (!client) {
      setIsConnected(false);
      setConnectionStatus(
        "Supabase env vars are empty. Lobby is running as a local UI scaffold."
      );
      setRoster([presenceRef.current]);
      return;
    }

    const channel = client.channel(`room:${normalizedCode}`, {
      config: {
        presence: { key: presenceRef.current.user_id },
        broadcast: { self: true },
      },
    });
    channelRef.current = channel;

    function recordEvent(event: PartyBroadcastEvent) {
      setLastEvent(event);
      if (event.event === "config_update") {
        configRef.current = event.payload;
        setConfigState(event.payload);
      }
    }

    channel
      .on("presence", { event: "sync" }, () => {
        setRoster(
          rosterFromPresenceState(
            channel.presenceState() as PresenceState,
            presenceRef.current
          )
        );
      })
      .on("broadcast", { event: "lobby_update" }, ({ payload }) =>
        recordEvent({ event: "lobby_update", payload })
      )
      .on("broadcast", { event: "config_update" }, ({ payload }) =>
        recordEvent({ event: "config_update", payload })
      )
      .on("broadcast", { event: "game_start" }, ({ payload }) =>
        recordEvent({ event: "game_start", payload })
      )
      .on("broadcast", { event: "round_start" }, ({ payload }) =>
        recordEvent({ event: "round_start", payload })
      )
      .on("broadcast", { event: "answer_ack" }, ({ payload }) =>
        recordEvent({ event: "answer_ack", payload })
      )
      .on("broadcast", { event: "round_reveal" }, ({ payload }) =>
        recordEvent({ event: "round_reveal", payload })
      )
      .on("broadcast", { event: "game_end" }, ({ payload }) =>
        recordEvent({ event: "game_end", payload })
      )
      .subscribe(async (status) => {
        setConnectionStatus(status);
        const connected = status === "SUBSCRIBED";
        setIsConnected(connected);
        if (connected) await channel.track(presenceRef.current);
      });

    return () => {
      channelRef.current = null;
      setIsConnected(false);
      void channel.untrack();
      void client.removeChannel(channel);
    };
  }, [normalizedCode]);

  async function sendBroadcast(event: PartyBroadcastEvent) {
    const channel = channelRef.current;
    if (!channel || !isConnected) return;
    await channel.send({
      type: "broadcast",
      event: event.event,
      payload: event.payload,
    });
  }

  async function setReady(ready: boolean) {
    const nextPresence = { ...presenceRef.current, ready };
    presenceRef.current = nextPresence;
    setRoster((current) =>
      rosterFromPresenceState(
        { local: current.map((player) => player.user_id === nextPresence.user_id ? nextPresence : player) },
        nextPresence
      )
    );

    if (channelRef.current && isConnected) {
      await channelRef.current.track(nextPresence);
      await sendBroadcast({
        event: "lobby_update",
        payload: { reason: "ready_toggle" },
      });
    }
  }

  async function updateConfig(nextConfig: MatchConfig) {
    configRef.current = nextConfig;
    setConfigState(nextConfig);
    await sendBroadcast({ event: "config_update", payload: nextConfig });
  }

  async function requestStart(): Promise<StartRequestResult> {
    return {
      ok: false,
      reason:
        "start_match remains an edge-function call. This client does not create sessions or advance MP state locally.",
    };
  }

  return {
    roster,
    config,
    isConnected,
    connectionStatus,
    lastEvent,
    channelName: normalizedCode ? `room:${normalizedCode}` : null,
    setReady,
    updateConfig,
    requestStart,
  };
}
