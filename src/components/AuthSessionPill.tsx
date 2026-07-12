"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase";

type SessionPayload = {
  authenticated: boolean;
  authConfigured: boolean;
  needsOnboarding?: boolean;
  actorName: string;
  actorRole: string;
  userEmail: string | null;
};

export default function AuthSessionPill() {
  const router = useRouter();
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as SessionPayload;
        if (!cancelled) {
          setSession(payload);
        }
      } catch {
        if (!cancelled) {
          setSession(null);
        }
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  async function signOut() {
    setBusy(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/auth");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!session?.authConfigured) {
    return (
      <div className="hidden items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800 md:flex">
        <ShieldCheck className="h-4 w-4" />
        Demo identity mode
      </div>
    );
  }

  if (!session.authenticated) {
    return null;
  }

  if (session.needsOnboarding) {
    return (
      <div className="hidden items-center gap-3 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 shadow-sm md:flex">
        <div className="rounded-full bg-amber-100 p-2 text-amber-700">
          <UserRound className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-amber-900">{session.actorName}</p>
          <p className="truncate text-[10px] uppercase tracking-[0.18em] text-amber-700">
            Setup required {session.userEmail ? `• ${session.userEmail}` : ""}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="hidden items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm md:flex">
      <div className="rounded-full bg-heritage-green/8 p-2 text-heritage-green">
        <UserRound className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-slate-900">{session.actorName}</p>
        <p className="truncate text-[10px] uppercase tracking-[0.18em] text-slate-400">
          {session.actorRole} {session.userEmail ? `• ${session.userEmail}` : ""}
        </p>
      </div>
      <button
        onClick={() => void signOut()}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-50"
      >
        <LogOut className="h-3.5 w-3.5" />
        {busy ? "Signing out" : "Sign out"}
      </button>
    </div>
  );
}
