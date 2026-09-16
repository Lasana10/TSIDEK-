"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { TSIDKENU_PRODUCT_LOGO } from "@/lib/tsidkenu-brand";

type SessionPayload = {
  authenticated: boolean;
  needsOnboarding?: boolean;
  firmId?: string | null;
  activeFirmId?: string | null;
  actorRole?: string | null;
  memberships?: Array<{ firm_id?: string | null }>;
};

type FounderAccessPayload = {
  success: boolean;
  error?: string;
  tokenHash?: string;
  verificationType?: string;
};

function safeRedirectTarget(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/auth")) return "/workspace";
  return value;
}

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [founderCode, setFounderCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [founderSubmitting, setFounderSubmitting] = useState(false);
  const [resolvingSession, setResolvingSession] = useState(true);
  const [redirectTarget, setRedirectTarget] = useState("/workspace");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRedirectTarget(safeRedirectTarget(params.get("redirectTo")));
    const message = params.get("error");
    if (message) setError(message);
  }, []);

  const continueIfSignedIn = useCallback(async () => {
    setResolvingSession(true);
    try {
      const response = await fetch("/api/session", { cache: "no-store", credentials: "include" });
      if (response.status === 401) return;
      if (!response.ok) throw new Error("Unable to resolve your TSIDKENU session.");
      const payload = await response.json() as SessionPayload;
      if (!payload.authenticated) return;
      if (payload.needsOnboarding) { router.replace("/onboarding"); return; }
      const ready = Boolean(payload.activeFirmId && payload.firmId && payload.actorRole && (payload.memberships?.length ?? 0) > 0);
      if (!ready) { setError("Your identity is verified, but the active firm context is incomplete."); return; }
      router.replace(safeRedirectTarget(redirectTarget));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to resolve your TSIDKENU session.");
    } finally { setResolvingSession(false); }
  }, [redirectTarget, router]);

  useEffect(() => {
    const supabase = createClient();
    void continueIfSignedIn();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (["SIGNED_IN", "TOKEN_REFRESHED", "INITIAL_SESSION"].includes(event)) void continueIfSignedIn();
    });
    return () => listener.subscription.unsubscribe();
  }, [continueIfSignedIn]);

  async function requestOtp() {
    if (!email.trim()) { setError("Enter your work email to continue."); return; }
    setSubmitting(true); setError(null); setStatus(null);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTarget)}`;
      const { error: signInError } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo, shouldCreateUser: true } });
      if (signInError) throw signInError;
      setStatus(`Secure sign-in link sent to ${email.trim()}.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to send the sign-in link."); }
    finally { setSubmitting(false); }
  }

  async function enterFounderWorkspace() {
    if (!founderCode.trim()) { setError("Enter the founder access code."); return; }
    setFounderSubmitting(true); setError(null); setStatus(null);
    try {
      const response = await fetch("/api/auth/founder-access", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode: founderCode.trim() }),
      });
      const payload = await response.json() as FounderAccessPayload;
      if (!response.ok || !payload.success || !payload.tokenHash) throw new Error(payload.error || "Unable to establish founder access.");

      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: payload.tokenHash,
        type: "magiclink",
      });
      if (verifyError) throw verifyError;

      setFounderCode("");
      setStatus("Founder session established. Opening workspace…");
      await continueIfSignedIn();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to establish founder access.");
    } finally {
      setFounderSubmitting(false);
    }
  }

  if (resolvingSession) return <main className="grid min-h-screen place-items-center bg-[#f2f4f1] p-6"><div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-xl"><Brand /><div className="mt-6 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-2/3 animate-pulse rounded-full bg-[#0b493b]" /></div><p className="mt-4 text-sm font-bold text-slate-800">Restoring secure workspace…</p><p className="mt-1 text-xs leading-5 text-slate-500">Identity, firm membership and role are being resolved before access opens.</p></div></main>;

  return (
    <main className="min-h-screen bg-[#eef2ef] p-3 sm:p-5 lg:p-7">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1500px] overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-[0_30px_90px_rgba(15,23,42,.12)] sm:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,.92fr)]">
        <section className="relative flex min-h-[320px] flex-col overflow-hidden bg-[#062f27] p-6 text-white sm:p-8 lg:min-h-0 lg:p-10 xl:p-12">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full border border-white/5 bg-white/[.025]" />
          <div className="relative"><Brand dark /></div>
          <div className="relative my-auto max-w-3xl py-10 lg:py-16">
            <p className="text-[10px] font-black uppercase tracking-[.28em] text-[#d7bd84]">Verified legal workspace</p>
            <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-[1.03] tracking-[-.045em] sm:text-5xl xl:text-6xl">Secure legal cooperation starts with verified identity.</h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/65 sm:text-base">One account can operate across the firm where the server grants authority. TSIDKENU never uses a cosmetic role selector to create permission.</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <Feature icon={ShieldCheck} title="Role-linked access" text="Authority comes from active firm membership and matter permissions." />
              <Feature icon={CheckCircle2} title="Persistent session" text="Session and firm context restore before the workspace is shown." />
            </div>
          </div>
          <p className="relative text-[10px] uppercase tracking-[.18em] text-white/28">Matter-first • Source-preserving • Human-supervised AI</p>
        </section>

        <section className="flex items-center bg-[#fbfcfb] p-6 sm:p-8 lg:p-10 xl:p-14">
          <div className="mx-auto w-full max-w-lg">
            <p className="text-[10px] font-black uppercase tracking-[.26em] text-[#0b493b]">Authentication</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-.03em] text-slate-950 sm:text-4xl">Enter your TSIDKENU workspace.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-500">Use founder direct access while email delivery is not in use. Normal firm users can continue using secure email links once outbound mail is enabled.</p>

            <div className="mt-8 rounded-[1.5rem] border border-[#cfded8] bg-[#f4f8f6] p-4 sm:p-5">
              <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#07372d] text-white"><KeyRound className="h-4 w-4" /></div><div><p className="text-sm font-bold text-slate-950">Founder direct access</p><p className="mt-0.5 text-xs text-slate-500">No email round-trip. Server-authorized founder account only.</p></div></div>
              <label className="mt-4 block"><span className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Founder access code</span><input value={founderCode} onChange={(e) => setFounderCode(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void enterFounderWorkspace(); }} type="password" autoComplete="current-password" placeholder="Enter founder code" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm outline-none focus:border-[#7ba598]" /></label>
              <button onClick={() => void enterFounderWorkspace()} disabled={founderSubmitting} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#07372d] px-5 py-4 text-sm font-bold text-white shadow-[0_14px_30px_rgba(7,55,45,.15)] disabled:opacity-50">{founderSubmitting ? "Establishing founder session…" : "Enter founder workspace"}<ArrowRight className="h-4 w-4" /></button>
            </div>

            <div className="my-6 flex items-center gap-3"><span className="h-px flex-1 bg-slate-200" /><span className="text-[9px] font-black uppercase tracking-[.16em] text-slate-400">Firm user sign-in</span><span className="h-px flex-1 bg-slate-200" /></div>

            <div className="space-y-3">
              <label className="block"><span className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Work email</span><div className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm focus-within:border-[#7ba598]"><Mail className="h-4 w-4 text-slate-400" /><input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void requestOtp(); }} type="email" placeholder="name@yourfirm.com" className="w-full bg-transparent py-4 text-sm outline-none" /></div></label>
              <button onClick={() => void requestOtp()} disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-700 disabled:opacity-50">{submitting ? "Sending secure link…" : "Send secure link"}<ArrowRight className="h-4 w-4" /></button>
            </div>
            {status && <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">{status}</div>}
            {error && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">{error}</div>}
          </div>
        </section>
      </div>
    </main>
  );
}

function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`relative h-[58px] w-[168px] overflow-hidden sm:h-[64px] sm:w-[188px] ${dark ? "" : "rounded-xl bg-[#07372d] px-2"}`}>
        <img src={TSIDKENU_PRODUCT_LOGO} alt="Tsidkenu" className="h-full w-full object-contain object-left" />
      </div>
      <div className="hidden md:block"><p className={`text-[9px] font-black uppercase tracking-[.18em] ${dark ? "text-white/35" : "text-slate-400"}`}>Legal operating system</p></div>
    </div>
  );
}

function Feature({ icon: Icon, title, text }: { icon: typeof ShieldCheck; title: string; text: string }) { return <div className="rounded-2xl border border-white/10 bg-white/[.055] p-4"><Icon className="h-5 w-5 text-[#d7bd84]" /><p className="mt-3 text-sm font-bold">{title}</p><p className="mt-1.5 text-xs leading-5 text-white/55">{text}</p></div>; }
