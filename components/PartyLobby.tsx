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
      <section className="ftw-card overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="ftw-chip-active uppercase tracking-[0.3em]">
                Party Lobby
              </span>
              <span className="ftw-chip">
                {channelName ?? "No realtime channel"}
              </span>
            </div>
            <div>
              <p className="ftw-label text-ftw-muted">Join code</p>
              <h1 className="ftw-number mt-2 text-6xl tracking-[0.18em] text-ftw-text sm:text-7xl">
                {code}
              </h1>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                readOnly
                value={shareUrl}
                aria-label="Share URL"
                className="ftw-input min-w-0 flex-1 text-sm"
              />
              <button
                type="button"
                onClick={onCopyShare}
                className="ftw-button-primary"
              >
                Copy Link
              </button>
              <button
                type="button"
                onClick={onLeave}
                className="ftw-button-secondary hover:border-ftw-danger hover:text-ftw-danger focus-visible:outline-ftw-danger"
              >
                Leave
              </button>
            </div>
          </div>

          <div className="ftw-card-muted p-5">
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
            <div className="mt-4 text-xs text-ftw-muted">
              Last event: {lastEvent ? lastEvent.event : "none"}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="ftw-card p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-2xl font-black text-ftw-text">Roster</h2>
              <p className="text-sm text-ftw-muted">2 to 8 players. Late join is lobby-only.</p>
            </div>
            <span className="ftw-chip text-sm text-ftw-text">
              {roster.length}/8
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {roster.map((player) => (
              <div
                key={player.user_id}
                className="flex items-center justify-between gap-4 rounded-ftw-sm border border-ftw-line bg-ftw-raised px-4 py-3 shadow-ftw-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-ftw-accent/15 font-black text-ftw-accent">
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
                  className={`rounded-full border px-3 py-1 text-xs font-bold ${
                    player.ready || player.is_host
                      ? "border-ftw-success bg-ftw-success/15 text-ftw-success"
                      : "border-ftw-line bg-ftw-canvas text-ftw-muted"
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
                  ? "bg-ftw-success text-ftw-panel hover:bg-ftw-success/90"
                  : "bg-ftw-accent text-ftw-panel hover:bg-ftw-accentDeep"
              }`}
            >
              {localPlayer?.ready ? "Ready" : "Mark Ready"}
            </button>
          )}
        </section>

        <section className="ftw-card p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-serif text-2xl font-black text-ftw-text">Match Config</h2>
              <p className="text-sm text-ftw-muted">
                {isHost ? "Host controls broadcast config_update." : "Waiting for host updates."}
              </p>
            </div>
            <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-ftw-line bg-ftw-raised">
              {([false, true] as const).map((ranked) => (
                <button
                  type="button"
                  key={ranked ? "ranked" : "casual"}
                  disabled={!isHost}
                  onClick={() => onConfigChange({ ...config, ranked })}
                  className={`px-4 py-2 text-sm font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ftw-accent disabled:cursor-not-allowed disabled:opacity-60 ${
                    config.ranked === ranked
                      ? ranked
                        ? "bg-ftw-danger text-ftw-panel"
                        : "bg-ftw-success text-ftw-panel"
                      : "bg-ftw-raised text-ftw-muted"
                  }`}
                >
                  {ranked ? "Ranked" : "Casual"}
                </button>
              ))}
            </div>
          </div>

          {config.ranked && (
            <p className="mt-3 rounded-xl border border-ftw-danger/40 bg-ftw-danger/10 px-4 py-3 text-sm text-ftw-danger">
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
                  className="ftw-input w-full"
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
                  className="ftw-input w-full"
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
                  className="ftw-input w-full"
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
                        ? "border-ftw-accent bg-ftw-accent text-ftw-panel"
                        : "border-ftw-line bg-ftw-raised text-ftw-muted hover:border-ftw-accent"
                    }`}
                  >
                    {seconds}s
                  </button>
                ))}
              </div>
            )}

            <label className="flex items-center justify-between gap-4 rounded-ftw-sm border border-ftw-line bg-ftw-raised px-4 py-3 shadow-ftw-sm">
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

            <div className="rounded-ftw-sm border border-ftw-line bg-ftw-canvas p-3 shadow-ftw-sm">
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
                className="ftw-button-primary w-full py-4"
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
