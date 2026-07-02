"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ensureCurrentUserProfile } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="ftw-page-shell min-h-screen px-6 py-10 text-ftw-text">
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
    <main className="ftw-page-shell min-h-screen px-6 py-10 text-ftw-text">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center justify-center">
        <div className="ftw-card p-8 text-center">
          <p className="ftw-label text-ftw-info">
            Auth callback
          </p>
          <h1 className="mt-3 font-serif text-3xl font-black">{message}</h1>
        </div>
      </div>
    </main>
  );
}
