"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinFirmClient({ token }: { token: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("Accept this invitation to join the firm in TSIDKENU.");

  async function acceptInvitation() {
    setStatus("working");
    setMessage("Verifying your invitation and firm membership…");
    try {
      const response = await fetch("/api/firm/invitations/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Unable to accept invitation.");
      setStatus("done");
      setMessage("Invitation accepted. Your active firm has been updated.");
      router.refresh();
      window.setTimeout(() => router.push("/"), 700);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to accept invitation.");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-16">
      <section className="w-full rounded-3xl border border-black/10 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-black/50">TSIDKENU Firm Access</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Join your firm workspace</h1>
        <p className="mt-4 text-sm leading-6 text-black/65">{message}</p>
        <button
          type="button"
          onClick={acceptInvitation}
          disabled={status === "working" || status === "done"}
          className="mt-8 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "working" ? "Accepting…" : status === "done" ? "Accepted" : "Accept invitation"}
        </button>
        {status === "error" ? <p className="mt-4 text-sm font-medium text-red-700">Sign in with the email address that received the invitation, then try again.</p> : null}
      </section>
    </main>
  );
}
