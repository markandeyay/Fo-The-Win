"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ensureCurrentUserProfile } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-ftw-dark px-6 py-10 text-ftw-text">
          <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center justify-center">
            Completing sign-in...
          </div>
        </main>
      }
    >
      <AuthCallbackClient />
    </Suspense>
  );
}

function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Completing sign-in...");

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setMessage("Supabase is not configured.");
        return;
      }

      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage(error.message);
          return;
        }
      }

      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        setMessage(error?.message ?? "No auth session was returned.");
        return;
      }

      const profileResult = await ensureCurrentUserProfile(supabase);
      if (profileResult.error) {
        setMessage(profileResult.error.message);
        return;
      }

      if (!cancelled) {
        router.replace("/");
      }
    }

    finish();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#082f49_0,#0b0f19_42%,#05070d_100%)] px-6 py-10 text-ftw-text">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center justify-center">
        <div className="rounded-3xl border border-ftw-info/40 bg-ftw-panel p-8 text-center shadow-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-ftw-info">
            Auth callback
          </p>
          <h1 className="mt-3 text-3xl font-black">{message}</h1>
        </div>
      </div>
    </main>
  );
}
