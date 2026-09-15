"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Loader2, ShieldCheck, UserRound } from "lucide-react";
import { defaultFirmCountry, firmRoleOptions, type FirmRole } from "@/lib/firm-identity";

type SessionPayload = {
  authenticated: boolean;
  contextStatus?: "unauthenticated" | "onboarding" | "ready" | "unauthorized" | "error";
  actorName?: string | null;
  actorRole?: string | null;
  userEmail?: string | null;
  needsOnboarding?: boolean;
  firmId?: string | null;
  activeFirmId?: string | null;
  memberships?: Array<{ firm_id?: string | null }>;
  error?: string;
};

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

async function readSession() {
  const response = await fetch("/api/session", {
    cache: "no-store",
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (response.status === 401) return null;
  const payload = (await response.json()) as SessionPayload;
  if (!response.ok) throw new Error(payload.error || "Unable to resolve your session.");
  return payload;
}

function sessionReady(payload: SessionPayload | null) {
  if (!payload) return false;
  return Boolean(
    payload.authenticated &&
      !payload.needsOnboarding &&
      payload.contextStatus === "ready" &&
      payload.firmId &&
      payload.activeFirmId &&
      payload.actorRole &&
      (payload.memberships?.length ?? 0) > 0,
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [firmName, setFirmName] = useState("");
  const [country, setCountry] = useState(defaultFirmCountry);
  const [role, setRole] = useState<FirmRole>("Junior Associate");

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const payload = await readSession();
        if (cancelled) return;

        if (!payload?.authenticated) {
          router.replace("/auth?redirectTo=/onboarding");
          return;
        }

        setSession(payload);
        setFullName((current) => current || payload.actorName || "");

        if (!payload.needsOnboarding) {
          router.replace("/workspace");
          return;
        }
      } catch (caughtError) {
        if (!cancelled) setError(caughtError instanceof Error ? caughtError.message : "Unable to start onboarding.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function completeSetup() {
    if (!fullName.trim() || !firmName.trim()) {
      setError("Your full name and firm name are required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          firmName: firmName.trim(),
          country: country.trim(),
          role,
        }),
      });

      const payload = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Unable to complete setup.");

      // The activation write is complete, but the workspace only opens after the
      // server can resolve the new membership + active firm + role in one session.
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const resolved = await readSession();
        if (sessionReady(resolved)) {
          router.replace("/workspace");
          router.refresh();
          return;
        }
        await sleep(250 * (attempt + 1));
      }

      throw new Error("Workspace activation completed, but the firm context is still synchronizing. Tap Activate workspace again to retry the secure handoff.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to complete setup.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f3f5f2] px-4 py-6 text-slate-800 md:px-8">
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[2rem] border border-[#17483c]/20 bg-[#082b22] p-7 text-white shadow-[0_24px_54px_rgba(0,54,41,0.18)] md:p-9">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/45">TSIDKENU · secure activation</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">Establish the firm context once, then enter the operating system.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70">Your identity, firm membership, active firm and role must resolve together before TSIDKENU opens any matter or administrative workspace.</p>
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.06] p-5"><Building2 className="h-5 w-5 text-[#dfc47f]" /><p className="mt-3 text-sm font-semibold">Real firm membership</p><p className="mt-2 text-sm leading-6 text-white/65">No demo firm, no cosmetic role selection and no client-side authority.</p></div>
            <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.06] p-5"><ShieldCheck className="h-5 w-5 text-[#dfc47f]" /><p className="mt-3 text-sm font-semibold">Verified handoff</p><p className="mt-2 text-sm leading-6 text-white/65">Activation is confirmed server-side before navigation to the role-native workspace.</p></div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] md:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#0f5b49]">First-run setup</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Activate your legal workspace</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">{session?.userEmail ? `Signed in as ${session.userEmail}.` : "Complete your firm identity below."}</p>

          <div className="mt-7 grid gap-4">
            <label><span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Full name</span><div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-[#fbfcfb] px-4 py-3"><UserRound className="h-4 w-4 text-slate-400" /><input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your name" className="w-full bg-transparent text-sm outline-none" /></div></label>
            <label><span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Firm name</span><div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-[#fbfcfb] px-4 py-3"><Building2 className="h-4 w-4 text-slate-400" /><input value={firmName} onChange={(event) => setFirmName(event.target.value)} placeholder="Cabinet / chamber / firm" className="w-full bg-transparent text-sm outline-none" /></div></label>
            <div className="grid gap-4 md:grid-cols-2"><label><span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Country</span><input value={country} onChange={(event) => setCountry(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-[#fbfcfb] px-4 py-3 text-sm outline-none" /></label><label><span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Role</span><select value={role} onChange={(event) => setRole(event.target.value as FirmRole)} className="mt-2 w-full rounded-xl border border-slate-200 bg-[#fbfcfb] px-4 py-3 text-sm outline-none">{firmRoleOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div>
          </div>

          {error ? <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">{error}</div> : null}

          <button onClick={() => void completeSetup()} disabled={loading || submitting} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#082b22] px-5 py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{loading || submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{submitting ? "Verifying firm context…" : loading ? "Restoring session…" : "Activate workspace"}<ArrowRight className="h-4 w-4" /></button>
        </section>
      </div>
    </main>
  );
}
