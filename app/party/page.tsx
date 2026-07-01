"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PartyLobby from "@/components/PartyLobby";
import taxonomy from "@/content/taxonomy.json";
import { usePartyRealtime, type MatchConfig, type PartyPresence } from "@/lib/usePartyRealtime";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_PATTERN = /^[A-Z0-9]{6}$/;

const defaultConfig: MatchConfig = {
  topicIds: ["ch1.order_of_ops"],
  difficulty: "easy",
  roundCount: 5,
  ranked: false,
  timerMode: "per_problem",
  fixedDurationSec: 25,
  firstSolveBonus: true,
};

function generateJoinCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => CODE_CHARS[byte % CODE_CHARS.length]).join("");
}

function getLocalPlayerId() {
  if (typeof window === "undefined") return "local-player";
  const stored = window.localStorage.getItem("ftw_party_player_id");
  if (stored) return stored;
  const next = crypto.randomUUID ? crypto.randomUUID() : `guest-${Date.now()}`;
  window.localStorage.setItem("ftw_party_player_id", next);
  return next;
}

function getInitialDisplayName() {
  if (typeof window === "undefined") return "Guest";
  return window.localStorage.getItem("ftw_party_display_name") || "Guest";
}

export default function PartyPage() {
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [displayName, setDisplayName] = useState(getInitialDisplayName);
  const [localUserId] = useState(getLocalPlayerId);
  const [isHost, setIsHost] = useState(false);
  const [origin, setOrigin] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [startMessage, setStartMessage] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code")?.trim().toUpperCase();
    if (code && CODE_PATTERN.test(code)) {
      setRoomCode(code);
      setJoinCode(code);
      setIsHost(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("ftw_party_display_name", displayName.trim() || "Guest");
  }, [displayName]);

  const topicOptions = useMemo(() => {
    const out: { topic_id: string; display_name: string; group_name: string }[] = [];
    for (const group of taxonomy.groups) {
      for (const leaf of group.leaves) {
        out.push({
          topic_id: leaf.topic_id,
          display_name: leaf.display_name,
          group_name: group.display_name,
        });
      }
    }
    return out;
  }, []);

  const localPlayer: PartyPresence = useMemo(
    () => ({
      user_id: localUserId,
      display_name: displayName.trim() || "Guest",
      ready: isHost,
      is_host: isHost,
    }),
    [displayName, isHost, localUserId]
  );

  const realtime = usePartyRealtime({
    code: roomCode,
    localPlayer,
    initialConfig: defaultConfig,
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || origin;
  const shareUrl = roomCode && siteUrl ? `${siteUrl}/party?code=${roomCode}` : "";
  const normalizedJoinCode = joinCode.trim().toUpperCase();
  const canJoin = CODE_PATTERN.test(normalizedJoinCode);
  const canCreate = displayName.trim().length > 0;

  function createParty() {
    if (!canCreate) return;
    const code = generateJoinCode();
    setRoomCode(code);
    setJoinCode(code);
    setIsHost(true);
    setStartMessage("");
    window.history.replaceState(null, "", `/party?code=${code}`);
  }

  function joinParty() {
    if (!canJoin || !canCreate) return;
    setRoomCode(normalizedJoinCode);
    setIsHost(false);
    setStartMessage("");
    window.history.replaceState(null, "", `/party?code=${normalizedJoinCode}`);
  }

  function leaveParty() {
    setRoomCode("");
    setJoinCode("");
    setIsHost(false);
    setCopyMessage("");
    setStartMessage("");
    window.history.replaceState(null, "", "/party");
  }

  async function copyShareLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopyMessage("Copied share link.");
  }

  async function startMatch() {
    const result = await realtime.requestStart();
    setStartMessage(result.reason);
  }

  if (roomCode) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#1d4ed833,transparent_32rem),#0b0f19] p-4 text-ftw-text sm:p-8">
        <PartyLobby
          code={roomCode}
          shareUrl={shareUrl}
          localUserId={localUserId}
          isHost={isHost}
          roster={realtime.roster}
          config={realtime.config}
          topicOptions={topicOptions}
          channelName={realtime.channelName}
          connectionStatus={realtime.connectionStatus}
          isConnected={realtime.isConnected}
          lastEvent={realtime.lastEvent}
          startMessage={startMessage}
          onCopyShare={copyShareLink}
          onLeave={leaveParty}
          onReadyChange={(ready) => void realtime.setReady(ready)}
          onConfigChange={(config) => void realtime.updateConfig(config)}
          onStart={() => void startMatch()}
        />
        {copyMessage && (
          <p className="mx-auto mt-4 max-w-6xl text-sm font-semibold text-ftw-success">
            {copyMessage}
          </p>
        )}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#2563eb44,transparent_28rem),#0b0f19] p-6 text-ftw-text">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl flex-col justify-center gap-8">
        <div className="space-y-4 text-center">
          <p className="text-sm font-black uppercase tracking-[0.45em] text-ftw-info">Multiplayer</p>
          <h1 className="text-5xl font-black tracking-tight text-white sm:text-7xl">Party Up</h1>
          <p className="mx-auto max-w-2xl text-lg text-ftw-muted">
            Create a room, share a 6-character code, and configure a server-authoritative match lobby.
          </p>
        </div>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-ftw-info/60 bg-ftw-panel p-6 shadow-2xl shadow-blue-950/30">
            <h2 className="text-2xl font-black text-white">Create Party</h2>
            <p className="mt-2 text-sm text-ftw-muted">
              Hosts can configure topics, difficulty, round count, timer mode, and casual or ranked intent.
            </p>
            <label className="mt-6 block space-y-2">
              <span className="text-sm text-ftw-muted">Display name</span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={24}
                className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-ftw-text outline-none focus:border-ftw-accent"
              />
            </label>
            <button
              onClick={createParty}
              disabled={!canCreate}
              className="mt-6 w-full rounded-xl bg-ftw-accent py-4 font-black text-ftw-dark transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Generate 6-Character Code
            </button>
          </div>

          <div className="rounded-3xl border border-gray-700 bg-ftw-panel p-6 shadow-xl">
            <h2 className="text-2xl font-black text-white">Join Party</h2>
            <p className="mt-2 text-sm text-ftw-muted">
              Enter the host code or open a shared link. Presence joins `room:CODE` when Supabase is configured.
            </p>
            <label className="mt-6 block space-y-2">
              <span className="text-sm text-ftw-muted">Display name</span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={24}
                className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-ftw-text outline-none focus:border-ftw-accent"
              />
            </label>
            <label className="mt-4 block space-y-2">
              <span className="text-sm text-ftw-muted">Join code</span>
              <input
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase().slice(0, 6))}
                placeholder="ABC123"
                className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 font-mono text-2xl font-black uppercase tracking-[0.25em] text-ftw-text outline-none focus:border-ftw-info"
              />
            </label>
            <button
              onClick={joinParty}
              disabled={!canJoin || !canCreate}
              className="mt-6 w-full rounded-xl bg-ftw-info py-4 font-black text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Join Lobby
            </button>
          </div>
        </section>

        <Link href="/" className="text-center text-ftw-muted underline transition hover:text-ftw-text">
          Back to Home
        </Link>
      </div>
    </main>
  );
}
