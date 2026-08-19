"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Mail, ShieldCheck, UserRoundPlus, XCircle } from "lucide-react";

export default function ClientAccessPanel({ matterId }: { matterId: string }) {
  const [grants, setGrants] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/matters/${matterId}/client-portal`, { credentials: "include", cache: "no-store" });
      const b = await r.json();
      if (!r.ok || !b.success) throw new Error(b.error || "Unable to load client access.");
      setGrants(b.grants ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load client access.");
    } finally {
      setLoading(false);
    }
  }, [matterId]);

  useEffect(() => { void load(); }, [load]);

  async function mutate(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/matters/${matterId}/client-portal`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const b = await r.json();
      if (!r.ok || !b.success) throw new Error(b.error || "Unable to update client access.");
      setEmail("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update client access.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[1.6rem] border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-heritage-green" />
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Client boundary</p>
          <h2 className="text-xl heading-serif text-heritage-green">Controlled client access</h2>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3">
          <Mail className="h-4 w-4 text-slate-400" />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="client@example.com"
            className="min-h-11 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <button
          type="button"
          disabled={busy || !email.includes("@")}
          onClick={() => void mutate({ action: "grant", clientEmail: email })}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-heritage-green px-4 py-3 text-xs font-bold text-white disabled:opacity-50"
        >
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserRoundPlus className="h-4 w-4" />}
          Grant access
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      <div className="mt-4 space-y-2">
        {loading ? (
          <p className="text-sm text-slate-500">Loading client grants…</p>
        ) : grants.length ? (
          grants.map((g) => (
            <div key={g.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">{g.client_email}</p>
                <p className="text-xs text-slate-500">{g.grant_status}</p>
              </div>
              {g.grant_status !== "REVOKED" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void mutate({ action: "revoke", grantId: g.id })}
                  className="inline-flex items-center gap-1 text-xs font-bold text-red-700"
                >
                  <XCircle className="h-4 w-4" /> Revoke
                </button>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">No client portal access granted.</p>
        )}
      </div>
    </section>
  );
}
