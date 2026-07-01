import type { SupabaseClient, User } from "@supabase/supabase-js";
import { loadGuestProfile, saveGuestProfile } from "./guestProfile";

export const AUTH_CALLBACK_PATH = "/auth/callback";

export function getAuthRedirectUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}${AUTH_CALLBACK_PATH}`;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  // TODO: Add the production Vercel domain here after Checkpoint 19.5 is complete.
  return `${siteUrl || "http://localhost:3000"}${AUTH_CALLBACK_PATH}`;
}

export function profileDefaultsFromUser(user: User): {
  username: string;
  display_name: string;
  avatar: string;
} {
  const metadata = user.user_metadata ?? {};
  const emailName = user.email?.split("@")[0];
  const guestSuffix = user.id.replace(/-/g, "").slice(0, 8);
  const username = String(
    metadata.username || emailName || `guest_${guestSuffix}`
  )
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 32);

  return {
    username: username || `guest_${guestSuffix}`,
    display_name: String(
      metadata.display_name || metadata.full_name || metadata.name || emailName || "Guest Player"
    ),
    avatar: String(metadata.avatar_url || ""),
  };
}

export async function ensureCurrentUserProfile(supabase: SupabaseClient) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { profile: null, error: userError ?? new Error("No signed-in user") };
  }

  const defaults = profileDefaultsFromUser(userData.user);
  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (selectError) {
    return { profile: null, error: selectError };
  }

  if (!existing) {
    return { profile: null, error: new Error("Profile row was not created by auth trigger") };
  }

  const patch: Record<string, string> = {};
  if (!existing.username) patch.username = defaults.username;
  if (!existing.display_name) patch.display_name = defaults.display_name;
  if (!existing.avatar && defaults.avatar) patch.avatar = defaults.avatar;

  if (Object.keys(patch).length > 0) {
    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", userData.user.id)
      .select("id, username, display_name, avatar")
      .single();

    return { profile: updated, error: updateError };
  }

  return { profile: existing, error: null };
}

export async function applyGuestProfileToCurrentUser(supabase: SupabaseClient) {
  const guest = loadGuestProfile();
  if (!guest) {
    return ensureCurrentUserProfile(supabase);
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { profile: null, error: userError ?? new Error("No signed-in user") };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      username: guest.username,
      display_name: guest.display_name,
      avatar: guest.avatar,
      title: guest.title,
      settings: guest.settings,
    })
    .eq("id", userData.user.id)
    .select("id, username, display_name, avatar")
    .single();

  if (!error) {
    saveGuestProfile({
      ...guest,
      id: userData.user.id,
      username: data.username,
      display_name: data.display_name ?? guest.display_name,
      avatar: data.avatar ?? guest.avatar,
    });
  }

  return { profile: data, error };
}
