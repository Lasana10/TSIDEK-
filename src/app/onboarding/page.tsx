"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Building2, CheckCircle2, Loader2, ShieldCheck, UserRound } from "lucide-react";
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

type ActivationPayload = {
  success?: boolean;
  workspaceReady?: boolean;
  firmId?: string | null;
  activeFirmId?: string | null;
  actorRole?: string | null;
  error?: string;
};

async function readSession() {
  const response = await fetch("/api/session", {
    cache: "no-store",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (response.status === 401) return null;
  const payload = (await response.json()) as SessionPayload;
  if (!response.ok) throw new Error(payload.error || "Unable to restore your session.");
  return payload;
}

function cleanName(actorName?: string | null, email?: string | null) {
  const value = actorName?.trim() ?? "";
  if (!value || value.includes("@") || (email && value.toLowerCase() === email.toLowerCase())) return "";
  return value;
}

export default function OnboardingPage() {
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

    async function restore() {
      try {
        const payload = await readSession();
        if (cancelled) return;

        if (!payload?.authenticated) {
          window.location.replace("/auth?redirectTo=%2Fworkspace");
          return;
        }

        // Returning members should never see first-run setup again.
        if (!payload.needsOnboarding) {
          window.location.replace("/workspace");
          return;
        }

        setSession(payload);
        setFullName((current) => current || cleanName(payload.actorName, payload.userEmail));
      } catch (caughtError) {
        if (!cancelled) setError(caughtError instanceof Error ? caughtError.message : "Unable to restore your session.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  async function activateWorkspace() {
    if (!fullName.trim() || !firmName.trim()) {
      setError("Enter your name and firm name to activate the workspace.");
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
      const payload = (await response.json()) as ActivationPayload;
      if (!response.ok || !payload.success) throw new Error(payload.error || "Workspace activation failed.");
      if (!payload.workspaceReady) {
        throw new Error("Your firm record was saved, but workspace authority could not be confirmed. Please refresh once; no second activation is required.");
      }

      // A hard replacement avoids stale App Router state and removes onboarding
      // from browser history after the server confirms authority.
      window.location.replace("/workspace");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Workspace activation failed.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f6f3] px-5 text-slate-900">
        <div className="w-full max-w-sm rounded-[1.75rem] border border-slate-200 bg-white p-6 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#082b22] text-[#d9ba78]"><Loader2 className="h-5 w-5 animate-spin" /></div>
          <h1 className="mt-4 text-lg font-semibold">Opening your workspace</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Restoring your secure firm context…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f6f3] px-4 py-5 text-slate-900 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-5 flex items-center gap-3 px-1">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#082b22] text-[#d9ba78]"><ShieldCheck className="h-5 w-5" /></div>
          <div>
            <p className="text-sm font-black tracking-[0.14em] text-[#082b22]">TSIDKENU</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Secure firm activation</p>
          </div>
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-100 bg-[#082b22] px-6 py-7 text-white sm:px-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/65"><CheckCircle2 className="h-3.5 w-3.5 text-[#d9ba78]" /> One-time setup</div>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.035em]">Activate your firm workspace</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">A short setup establishes your identity and firm authority. After this, TSIDKENU opens directly to your role-native workspace.</p>
          </div>

          <div className="p-6 sm:p-8">
            {session?.userEmail ? (
              <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm"><CheckCircle2 className="h-4 w-4" /></div>
                <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.13em] text-emerald-700">Identity verified</p><p className="truncate text-sm font-semibold text-slate-800">{session.userEmail}</p></div>
              </div>
            ) : null}

            <div className="grid gap-4">
              <Field label="Your name" icon={UserRound} value={fullName} onChange={setFullName} placeholder="Full professional name" autoComplete="name" />
              <Field label="Firm" icon={Building2} value={firmName} onChange={setFirmName} placeholder="Firm / cabinet / chamber" autoComplete="organization" />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-400">Country</span><input value={country} onChange={(event) => setCountry(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-[#fbfcfb] px-4 py-3.5 text-sm outline-none transition focus:border-[#7da797]" /></label>
                <label className="block"><span className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-400">Role</span><select value={role} onChange={(event) => setRole(event.target.value as FirmRole)} className="mt-2 w-full rounded-xl border border-slate-200 bg-[#fbfcfb] px-4 py-3.5 text-sm outline-none transition focus:border-[#7da797]">{firmRoleOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              </div>
            </div>

            {error ? <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">{error}</div> : null}

            <button onClick={() => void activateWorkspace()} disabled={submitting} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#082b22] px-5 py-4 text-sm font-bold text-white shadow-[0_12px_30px_rgba(8,43,34,0.18)] transition hover:bg-[#0d3b30] disabled:cursor-not-allowed disabled:opacity-60">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{submitting ? "Activating…" : "Enter workspace"}<ArrowRight className="h-4 w-4" /></button>
            <p className="mt-3 text-center text-[11px] leading-5 text-slate-400">Your role is enforced by server-side firm membership. This screen cannot grant itself authority.</p>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, icon: Icon, value, onChange, placeholder, autoComplete }: { label: string; icon: typeof UserRound; value: string; onChange: (value: string) => void; placeholder: string; autoComplete: string }) {
  return <label className="block"><span className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-400">{label}</span><div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-[#fbfcfb] px-4 py-3.5 focus-within:border-[#7da797]"><Icon className="h-4 w-4 shrink-0 text-slate-400" /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete={autoComplete} className="w-full bg-transparent text-sm outline-none" /></div></label>;
}
