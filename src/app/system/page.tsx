"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleAlert, Loader2, Network, RefreshCw, ShieldCheck, Sparkles, WalletCards } from "lucide-react";

type Provider = { provider: string; kind: string; configured: boolean; missing: string[]; mode?: string };
type VerifyState = { state: "idle" | "running" | "ok" | "error"; message?: string };

const labels: Record<string, string> = {
  nextcloud: "Nextcloud",
  onedrive: "Microsoft OneDrive",
  meta_whatsapp: "Meta WhatsApp",
  firebase: "Firebase Cloud Messaging",
  resend: "Resend",
  openrouter: "OpenRouter AI",
  pawapay: "pawaPay",
};

const verifiable = new Set(["nextcloud", "firebase", "meta_whatsapp", "openrouter", "pawapay"]);

export default function SystemPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verify, setVerify] = useState<Record<string, VerifyState>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/integrations/health", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || "Unable to load integration status.");
      setProviders(Array.isArray(json.providers) ? json.providers : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load integration status.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyProvider(provider: string) {
    setVerify((current) => ({ ...current, [provider]: { state: "running" } }));
    try {
      const response = await fetch("/api/integrations/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json?.error || "Verification failed.");
      setVerify((current) => ({ ...current, [provider]: { state: "ok", message: `Verified ${new Date(json.verifiedAt).toLocaleTimeString()}` } }));
    } catch (e) {
      setVerify((current) => ({ ...current, [provider]: { state: "error", message: e instanceof Error ? e.message : "Verification failed." } }));
    }
  }

  useEffect(() => { void load(); }, []);

  const configuredCount = providers.filter((p) => p.configured).length;

  return (
    <main className="min-h-screen bg-[#f6f7f4] px-4 py-6 text-slate-700 md:px-6 xl:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <div className="flex flex-col gap-4 rounded-[2rem] border border-white bg-[linear-gradient(135deg,#082b22,#123f33)] p-6 text-white shadow-[0_24px_70px_rgba(0,54,41,0.18)] md:p-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <Link href="/" className="mb-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/55 hover:text-white"><ArrowLeft className="h-4 w-4" />Command centre</Link>
            <div className="flex items-center gap-3"><div className="rounded-2xl bg-white/10 p-3"><Network className="h-6 w-6 text-emerald-300" /></div><div><p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/45">Firm infrastructure</p><h1 className="mt-1 text-3xl font-semibold md:text-4xl">System & Integration Control</h1></div></div>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">See what TSIDKENU can actually reach from the running environment. Configuration and verification are intentionally separated so a filled environment variable is never presented as proof of a working provider.</p>
          </div>
          <button onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] hover:bg-white/15"><RefreshCw className="h-4 w-4" />Refresh</button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Configured providers</p><p className="mt-2 text-3xl font-black text-heritage-green">{configuredCount}<span className="text-base font-semibold text-slate-400"> / {providers.length || "—"}</span></p></div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">AI governance</p><div className="mt-2 flex items-center gap-2 text-heritage-green"><Sparkles className="h-5 w-5" /><span className="font-bold">OpenRouter · Gemini · Local</span></div><p className="mt-2 text-xs leading-5 text-slate-500">Firm privacy policy decides which route is permitted.</p></div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Payments</p><div className="mt-2 flex items-center gap-2 text-heritage-green"><WalletCards className="h-5 w-5" /><span className="font-bold">pawaPay deposit path</span></div><p className="mt-2 text-xs leading-5 text-slate-500">Client collections are modelled as deposits, not payouts.</p></div>
        </div>

        {error ? <div className="rounded-[1.4rem] border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div> : null}
        {loading ? <div className="flex min-h-[240px] items-center justify-center rounded-[1.6rem] border border-slate-200 bg-white"><Loader2 className="h-6 w-6 animate-spin text-heritage-green" /></div> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {providers.map((item) => {
              const state = verify[item.provider] || { state: "idle" as const };
              return (
                <article key={item.provider} className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{item.kind} · {item.mode || "server"}</p><h2 className="mt-1 text-lg font-semibold text-heritage-green">{labels[item.provider] || item.provider}</h2></div>
                    {item.configured ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <CircleAlert className="h-5 w-5 text-amber-500" />}
                  </div>
                  <div className={`mt-4 rounded-xl px-3 py-2 text-xs font-bold ${item.configured ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{item.configured ? "Server configuration present" : `Missing: ${item.missing.join(", ") || "configuration"}`}</div>
                  {state.message ? <p className={`mt-3 text-xs leading-5 ${state.state === "ok" ? "text-emerald-700" : "text-red-600"}`}>{state.message}</p> : null}
                  <div className="mt-5 flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400"><ShieldCheck className="h-3.5 w-3.5" />Secrets stay server-side</span>{verifiable.has(item.provider) ? <button disabled={!item.configured || state.state === "running"} onClick={() => void verifyProvider(item.provider)} className="inline-flex items-center gap-2 rounded-full bg-[#082b22] px-4 py-2 text-[10px] font-black uppercase tracking-[0.17em] text-white disabled:cursor-not-allowed disabled:opacity-40">{state.state === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Verify</button> : null}</div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
