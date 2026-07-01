"use client";

import { useMemo } from "react";
import { TopicTree, type TopicTreeGroup } from "@/components/TopicTree";
import type {
  MatchConfig,
  PartyBroadcastEvent,
  PartyPresence,
} from "@/lib/usePartyRealtime";

interface TopicOption {
  topic_id: string;
  display_name: string;
  group_name: string;
}

interface PartyLobbyProps {
  code: string;
  shareUrl: string;
  localUserId: string;
  isHost: boolean;
  roster: PartyPresence[];
  config: MatchConfig;
  topicOptions: TopicOption[];
  channelName: string | null;
  connectionStatus: string;
  isConnected: boolean;
  lastEvent: PartyBroadcastEvent | null;
  startMessage: string;
  onCopyShare: () => void;
  onLeave: () => void;
  onReadyChange: (ready: boolean) => void;
  onConfigChange: (config: MatchConfig) => void;
  onStart: () => void;
}

export default function PartyLobby({
  code,
  shareUrl,
  localUserId,
  isHost,
  roster,
  config,
  topicOptions,
  channelName,
  connectionStatus,
  isConnected,
  lastEvent,
  startMessage,
  onCopyShare,
  onLeave,
  onReadyChange,
  onConfigChange,
  onStart,
}: PartyLobbyProps) {
  const localPlayer = roster.find((player) => player.user_id === localUserId);
  const allGuestsCanStart = !config.ranked;
  const hasEnoughPlayers = roster.length >= 2 && roster.length <= 8;
  const nonHostReady = roster
    .filter((player) => !player.is_host)
    .every((player) => player.ready);
  const canStart = isHost && hasEnoughPlayers && nonHostReady && config.topicIds.length > 0 && allGuestsCanStart;
  const topicGroups = useMemo<TopicTreeGroup[]>(() => {
    const groups = new Map<string, TopicTreeGroup>();
    for (const topic of topicOptions) {
      const groupId = topic.group_name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      const group = groups.get(groupId) ?? {
        group_id: groupId,
        display_name: topic.group_name,
        leaves: [],
      };
      group.leaves.push({
        topic_id: topic.topic_id,
        display_name: topic.display_name,
      });
      groups.set(groupId, group);
    }
    return [...groups.values()];
  }, [topicOptions]);

  return (
    <div className="w-full max-w-6xl space-y-6">
      <section className="overflow-hidden rounded-3xl border border-ftw-info/60 bg-ftw-panel shadow-2xl shadow-blue-950/30">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-ftw-accent/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.3em] text-ftw-accent">
                Party Lobby
              </span>
              <span className="rounded-full bg-gray-900 px-3 py-1 text-xs text-ftw-muted">
                {channelName ?? "No realtime channel"}
              </span>
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-ftw-muted">Join code</p>
              <h1 className="mt-2 font-mono text-6xl font-black tracking-[0.18em] text-white sm:text-7xl">
                {code}
              </h1>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                readOnly
                value={shareUrl}
                aria-label="Share URL"
                className="min-w-0 flex-1 rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-ftw-text outline-none"
              />
              <button
                type="button"
                onClick={onCopyShare}
                className="rounded-xl bg-ftw-info px-5 py-3 font-bold text-white transition hover:bg-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ftw-info"
              >
                Copy Link
              </button>
              <button
                type="button"
                onClick={onLeave}
                className="rounded-xl border border-gray-700 px-5 py-3 font-semibold text-ftw-muted transition hover:border-ftw-danger hover:text-ftw-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ftw-danger"
              >
                Leave
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-700 bg-gray-950/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-ftw-muted">Realtime status</p>
                <p className="mt-1 font-semibold text-ftw-text">{connectionStatus}</p>
              </div>
              <span
                className={`h-3 w-3 rounded-full ${
                  isConnected ? "bg-ftw-success" : "bg-ftw-muted"
                }`}
                aria-label={isConnected ? "Connected" : "Not connected"}
              />
            </div>
            <div className="mt-4 rounded-xl bg-gray-900 p-4 text-sm text-ftw-muted">
              <p className="font-semibold text-ftw-text">Server truth guardrails</p>
              <p className="mt-2">
                This lobby only projects presence and server broadcasts. Multiplayer scoring, timing, problem selection, and state advancement remain edge-function responsibilities.
              </p>
            </div>
            <div className="mt-4 text-xs text-ftw-muted">
              Last event: {lastEvent ? lastEvent.event : "none"}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-3xl border border-gray-700 bg-ftw-panel p-6 shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-white">Roster</h2>
              <p className="text-sm text-ftw-muted">2 to 8 players. Late join is lobby-only.</p>
            </div>
            <span className="rounded-full bg-gray-900 px-3 py-1 text-sm font-bold text-ftw-text">
              {roster.length}/8
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {roster.map((player) => (
              <div
                key={player.user_id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-ftw-info/20 font-black text-ftw-info">
                    {player.avatar || player.display_name.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-ftw-text">{player.display_name}</p>
                    <p className="text-xs text-ftw-muted">
                      {player.is_host ? "Host" : "Player"}
                      {player.user_id === localUserId ? " - You" : ""}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    player.ready || player.is_host
                      ? "bg-ftw-success/20 text-ftw-success"
                      : "bg-gray-800 text-ftw-muted"
                  }`}
                >
                  {player.is_host ? "HOST" : player.ready ? "READY" : "WAITING"}
                </span>
              </div>
            ))}
          </div>

          {!isHost && (
            <button
              type="button"
              onClick={() => onReadyChange(!localPlayer?.ready)}
              className={`mt-5 w-full rounded-xl py-3 font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ftw-accent ${
                localPlayer?.ready
                  ? "bg-ftw-success text-ftw-dark hover:bg-green-300"
                  : "bg-ftw-accent text-ftw-dark hover:bg-amber-400"
              }`}
            >
              {localPlayer?.ready ? "Ready" : "Mark Ready"}
            </button>
          )}
        </section>

        <section className="rounded-3xl border border-gray-700 bg-ftw-panel p-6 shadow-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-black text-white">Match Config</h2>
              <p className="text-sm text-ftw-muted">
                {isHost ? "Host controls broadcast config_update." : "Waiting for host updates."}
              </p>
            </div>
            <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-gray-700">
              {([false, true] as const).map((ranked) => (
                <button
                  type="button"
                  key={ranked ? "ranked" : "casual"}
                  disabled={!isHost}
                  onClick={() => onConfigChange({ ...config, ranked })}
                  className={`px-4 py-2 text-sm font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ftw-accent disabled:cursor-not-allowed disabled:opacity-60 ${
                    config.ranked === ranked
                      ? ranked
                        ? "bg-ftw-danger text-white"
                        : "bg-ftw-success text-ftw-dark"
                      : "bg-gray-950 text-ftw-muted"
                  }`}
                >
                  {ranked ? "Ranked" : "Casual"}
                </button>
              ))}
            </div>
          </div>

          {config.ranked && (
            <p className="mt-3 rounded-xl border border-ftw-danger/40 bg-ftw-danger/10 px-4 py-3 text-sm text-red-200">
              Ranked start must be rejected by the server for guest-only rooms until authenticated profiles are present.
            </p>
          )}

          <fieldset disabled={!isHost} className="mt-5 space-y-5 disabled:opacity-70">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="space-y-2">
                <span className="text-sm text-ftw-muted">Difficulty</span>
                <select
                  value={config.difficulty}
                  onChange={(event) =>
                    onConfigChange({ ...config, difficulty: event.target.value as MatchConfig["difficulty"] })
                  }
                  className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-ftw-text outline-none focus:border-ftw-accent focus:ring-2 focus:ring-ftw-accent/30"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm text-ftw-muted">Rounds</span>
                <select
                  value={config.roundCount}
                  onChange={(event) =>
                    onConfigChange({ ...config, roundCount: Number(event.target.value) as MatchConfig["roundCount"] })
                  }
                  className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-ftw-text outline-none focus:border-ftw-accent focus:ring-2 focus:ring-ftw-accent/30"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm text-ftw-muted">Timer</span>
                <select
                  value={config.timerMode}
                  onChange={(event) =>
                    onConfigChange({ ...config, timerMode: event.target.value as MatchConfig["timerMode"] })
                  }
                  className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-ftw-text outline-none focus:border-ftw-accent focus:ring-2 focus:ring-ftw-accent/30"
                >
                  <option value="per_problem">Per problem</option>
                  <option value="fixed">Fixed</option>
                </select>
              </label>
            </div>

            {config.timerMode === "fixed" && (
              <div className="grid grid-cols-3 gap-2">
                {([25, 45, 75] as const).map((seconds) => (
                  <button
                    key={seconds}
                    type="button"
                    onClick={() => onConfigChange({ ...config, fixedDurationSec: seconds })}
                    className={`rounded-xl border px-4 py-3 font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ftw-accent ${
                      config.fixedDurationSec === seconds
                        ? "border-ftw-accent bg-ftw-accent text-ftw-dark"
                        : "border-gray-700 bg-gray-950 text-ftw-muted hover:border-ftw-accent"
                    }`}
                  >
                    {seconds}s
                  </button>
                ))}
              </div>
            )}

            <label className="flex items-center justify-between gap-4 rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3">
              <span>
                <span className="block font-bold text-ftw-text">First solve bonus</span>
                <span className="text-sm text-ftw-muted">Default on for casual, usually off for ranked.</span>
              </span>
              <input
                type="checkbox"
                checked={config.firstSolveBonus}
                onChange={(event) =>
                  onConfigChange({ ...config, firstSolveBonus: event.target.checked })
                }
                className="h-5 w-5 accent-ftw-accent"
              />
            </label>

            <div className="rounded-2xl border border-gray-700 bg-gray-950 p-3">
              <TopicTree
                groups={topicGroups}
                selectedTopicIds={config.topicIds}
                onSelectedTopicIdsChange={(topicIds) => onConfigChange({ ...config, topicIds })}
                disabled={!isHost}
                title="Topics"
                description={`${config.topicIds.length} selected for this lobby`}
                maxHeightClassName="max-h-72"
                defaultOpenCount={3}
                compact
              />
            </div>
          </fieldset>

          {isHost && (
            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={onStart}
                disabled={!canStart}
                className="w-full rounded-xl bg-ftw-accent py-4 font-black text-ftw-dark transition hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ftw-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start Match
              </button>
              <p className="text-sm text-ftw-muted">
                {!hasEnoughPlayers
                  ? "Need 2 to 8 players."
                  : !nonHostReady
                    ? "Waiting for players to ready up."
                    : config.topicIds.length === 0
                      ? "Select at least one topic."
                      : config.ranked
                        ? "Ranked requires server-side auth checks before start."
                        : startMessage || "Ready to call start_match when edge functions are available."}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
