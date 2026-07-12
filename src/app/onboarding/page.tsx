"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, ShieldCheck, UserRound } from "lucide-react";
import { defaultFirmCountry, firmRoleOptions, type FirmRole } from "@/lib/firm-identity";

type SessionPayload = {
  authenticated: boolean;
  authConfigured: boolean;
  actorName: string;
  actorRole: string;
  userEmail: string | null;
  needsOnboarding?: boolean;
};

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
        const response = await fetch("/api/session", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Unable to resolve your session.");
        }

        const payload = (await response.json()) as SessionPayload;

        if (cancelled) {
          return;
        }

        setSession(payload);
        setFullName((current) => current || payload.actorName || "");

        if (!payload.authenticated) {
          router.replace("/auth?redirectTo=/onboarding");
          return;
        }

        if (!payload.needsOnboarding) {
          router.replace("/");
          return;
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : "Unable to start onboarding.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          firmName: firmName.trim(),
          country: country.trim(),
          role,
        }),
      });

      const payload = (await response.json()) as { success?: boolean; error?: string };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to complete setup.");
      }

      router.replace("/");
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to complete setup.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-paper-white px-6 py-8 md:px-8">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(155deg,_#082b22_0%,_#0d4335_56%,_#c5a059_170%)] p-8 text-white shadow-[0_24px_54px_rgba(0,54,41,0.18)]">
          <p className="text-[10px] font-black uppercase tracking-[0.32em] text-white/55">TSIDEK first-run setup</p>
          <h1 className="mt-4 text-4xl heading-serif text-white">Create the firm context before you open the operating system.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/74">
            We now use a real onboarding step instead of assigning you to a fake default firm. That keeps the production data model honest from the first login.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.4rem] border border-white/10 bg-white/8 p-5">
              <Building2 className="h-5 w-5 text-gold-accent" />
              <p className="mt-3 text-sm font-semibold">Firm-first identity</p>
              <p className="mt-2 text-sm leading-6 text-white/70">
                Each lawyer now belongs to a real firm record before using matters, documents, or collaboration.
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/8 p-5">
              <ShieldCheck className="h-5 w-5 text-gold-accent" />
              <p className="mt-3 text-sm font-semibold">Safer production posture</p>
              <p className="mt-2 text-sm leading-6 text-white/70">
                Roles and permissions now start from explicit setup instead of hidden demo bootstrap behavior.
              </p>
            </div>
          </div>
        </section>

        <section className="glass rounded-[2rem] p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Onboarding</p>
          <h2 className="mt-3 text-2xl heading-serif text-heritage-green">Set up your firm identity</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            {session?.userEmail ? `Signed in as ${session.userEmail}.` : "Complete these details to activate your legal workspace."}
          </p>

          <div className="mt-8 grid gap-4">
            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Full name</span>
              <div className="flex items-center gap-3 rounded-[1rem] border border-slate-200 bg-[#fcfcfb] px-4 py-3">
                <UserRound className="h-4 w-4 text-slate-400" />
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Your name"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Firm name</span>
              <div className="flex items-center gap-3 rounded-[1rem] border border-slate-200 bg-[#fcfcfb] px-4 py-3">
                <Building2 className="h-4 w-4 text-slate-400" />
                <input
                  value={firmName}
                  onChange={(event) => setFirmName(event.target.value)}
                  placeholder="Cabinet / chamber / firm"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Country</span>
                <input
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                  className="w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] px-4 py-3 text-sm outline-none"
                />
              </label>

              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Role</span>
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value as FirmRole)}
                  className="w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] px-4 py-3 text-sm outline-none"
                >
                  {firmRoleOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {error ? (
            <div className="mt-6 rounded-[1.2rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {error}
            </div>
          ) : null}

          <div className="mt-8">
            <button
              onClick={() => void completeSetup()}
              disabled={loading || submitting}
              className="inline-flex items-center gap-2 rounded-full bg-heritage-green px-5 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Setting up..." : "Activate workspace"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
