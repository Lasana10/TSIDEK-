"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Mail, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [redirectTarget, setRedirectTarget] = useState("/");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const message = params.get("error");
    const nextPath = params.get("redirectTo");

    if (message) {
      setError(message);
    }

    if (nextPath) {
      setRedirectTarget(nextPath);
    }
  }, []);

  async function requestOtp() {
    if (!email.trim()) {
      setError("Enter your work email to continue.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setStatus(null);

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTarget)}`;

      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true,
        },
      });

      if (signInError) {
        throw signInError;
      }

      setStatus(`Secure sign-in link sent to ${email.trim()}.`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to send the sign-in link.");
    } finally {
      setSubmitting(false);
    }
  }

  async function continueIfSignedIn() {
    try {
      const response = await fetch("/api/session", { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { authenticated: boolean; needsOnboarding?: boolean };

      if (payload.authenticated) {
        router.replace(payload.needsOnboarding ? "/onboarding" : redirectTarget);
      }
    } catch {
      // Keep the auth form visible if session resolution fails.
    }
  }

  useEffect(() => {
    void continueIfSignedIn();
  }, [redirectTarget]);

  return (
    <main className="min-h-screen bg-paper-white px-6 py-8 md:px-8">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(155deg,_#082b22_0%,_#0d4335_56%,_#c5a059_170%)] p-8 text-white shadow-[0_24px_54px_rgba(0,54,41,0.18)]">
          <p className="text-[10px] font-black uppercase tracking-[0.32em] text-white/55">TSIDEK OS access</p>
          <h1 className="mt-4 text-4xl heading-serif text-white">Secure legal cooperation starts with verified identity.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/74">
            Sign in with your firm email to open the matter workspace, activate role-aware permissions, and keep every client action attributable.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.4rem] border border-white/10 bg-white/8 p-5">
              <ShieldCheck className="h-5 w-5 text-gold-accent" />
              <p className="mt-3 text-sm font-semibold">Role-linked access</p>
              <p className="mt-2 text-sm leading-6 text-white/70">
                Partner, lawyer, project manager, and intern actions can now be enforced by the backend.
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/8 p-5">
              <Mail className="h-5 w-5 text-gold-accent" />
              <p className="mt-3 text-sm font-semibold">Low-friction sign-in</p>
              <p className="mt-2 text-sm leading-6 text-white/70">
                Email OTP keeps onboarding simple while still giving us real session-backed identity.
              </p>
            </div>
          </div>
        </section>

        <section className="glass rounded-[2rem] p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Authentication</p>
          <h2 className="mt-3 text-2xl heading-serif text-heritage-green">Sign in with your work email</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            We’ll send a secure sign-in link. Once you confirm it, TSIDEK will open setup if your firm profile is still missing.
          </p>

          <div className="mt-8 space-y-4">
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="name@yourfirm.com"
              className="w-full rounded-[1.2rem] border border-slate-200 bg-white px-4 py-4 text-sm outline-none transition focus:border-heritage-green"
            />
            <button
              onClick={() => void requestOtp()}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full bg-heritage-green px-5 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Send secure link"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {status ? (
            <div className="mt-6 rounded-[1.2rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {status}
            </div>
          ) : null}

          {error ? (
            <div className="mt-6 rounded-[1.2rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {error}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
