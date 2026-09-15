"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Clipboard,
  Clock3,
  Copy,
  Loader2,
  MailPlus,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  UsersRound,
  XCircle,
} from "lucide-react";

type Invitation = {
  id: string;
  email: string;
  role_key: string;
  status: string;
  expires_at: string;
  accepted_at?: string | null;
  created_at: string;
};

type InvitationResponse = {
  success: boolean;
  invitations?: Invitation[];
  invitation?: Invitation;
  inviteUrl?: string;
  error?: string;
};

const roleOptions = [
  ["partner", "Partner", "Firm governance, approvals and matter authority"],
  ["lawyer", "Lawyer", "Matter execution, drafting and client work"],
  ["paralegal", "Paralegal", "File operations, evidence and deadlines"],
  ["intern", "Intern", "Supervised research and drafting"],
  ["administrator", "Administrator", "Firm operations and access support"],
  ["finance", "Finance", "Billing, collections and reconciliation"],
  ["clerk", "Clerk", "Registry, filing and operational support"],
  ["knowledge_manager", "Knowledge manager", "Sources, precedent and institutional memory"],
] as const;

export default function FirmAccessPanel() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [roleKey, setRoleKey] = useState("lawyer");
  const [lifetimeHours, setLifetimeHours] = useState("168");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latestInviteUrl, setLatestInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/firm/invitations", { cache: "no-store", credentials: "include" });
      const payload = (await response.json()) as InvitationResponse;
      if (!response.ok || !payload.success) throw new Error(payload.error || "Unable to load firm invitations.");
      setInvitations(payload.invitations ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load firm invitations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedRole = useMemo(() => roleOptions.find(([key]) => key === roleKey), [roleKey]);
  const pendingCount = invitations.filter((invitation) => invitation.status === "pending" && new Date(invitation.expires_at).getTime() > Date.now()).length;
  const acceptedCount = invitations.filter((invitation) => invitation.status === "accepted").length;

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    setLatestInviteUrl(null);
    try {
      const response = await fetch("/api/firm/invitations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, roleKey, lifetimeHours: Number(lifetimeHours) || 168 }),
      });
      const payload = (await response.json()) as InvitationResponse;
      if (!response.ok || !payload.success || !payload.invitation) throw new Error(payload.error || "Unable to create invitation.");
      setLatestInviteUrl(payload.inviteUrl ?? null);
      setMessage(`Invitation created for ${payload.invitation.email}.`);
      setEmail("");
      await load();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Unable to create invitation.");
    } finally {
      setSubmitting(false);
    }
  }

  async function revoke(invitationId: string) {
    setBusyId(invitationId);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/firm/invitations", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      });
      const payload = (await response.json()) as InvitationResponse;
      if (!response.ok || !payload.success) throw new Error(payload.error || "Unable to revoke invitation.");
      setMessage("Pending invitation revoked.");
      await load();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Unable to revoke invitation.");
    } finally {
      setBusyId(null);
    }
  }

  async function resend(invitation: Invitation) {
    setBusyId(invitation.id);
    setError(null);
    setMessage(null);
    setLatestInviteUrl(null);
    try {
      const response = await fetch("/api/firm/invitations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: invitation.email, roleKey: invitation.role_key, lifetimeHours: 168 }),
      });
      const payload = (await response.json()) as InvitationResponse;
      if (!response.ok || !payload.success) throw new Error(payload.error || "Unable to refresh invitation.");
      setLatestInviteUrl(payload.inviteUrl ?? null);
      setMessage(`A fresh invitation was created for ${invitation.email}.`);
      await load();
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : "Unable to refresh invitation.");
    } finally {
      setBusyId(null);
    }
  }

  async function copyInvite() {
    if (!latestInviteUrl) return;
    await navigator.clipboard.writeText(latestInviteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section id="firm-access" className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.045)] md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-[#edf4f0] p-2.5 text-[#0b493b]"><UsersRound className="h-5 w-5" /></div><div><p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#0f5b49]">Firm establishment</p><h2 className="text-xl font-semibold tracking-tight text-slate-950">Identity first. Authority second. Workspace last.</h2></div></div>
          <p className="mt-3 text-sm leading-6 text-slate-500">A role is established through a governed firm invitation and accepted membership. This is not a cosmetic role picker: the active membership determines the server-side permissions used throughout TSIDKENU.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MiniMetric value={pendingCount} label="Pending" icon={Clock3} />
          <MiniMetric value={acceptedCount} label="Accepted" icon={Check} />
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <form onSubmit={invite} className="rounded-[1.4rem] border border-slate-200 bg-[#fbfcfb] p-4 md:p-5">
          <div className="flex items-center gap-2"><MailPlus className="h-4 w-4 text-[#0b493b]" /><h3 className="text-sm font-bold text-slate-950">Invite a firm member</h3></div>
          <div className="mt-4 space-y-4">
            <label className="block"><span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Email address</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="member@firm.com" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-[#7da797]" /></label>
            <label className="block"><span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Firm role</span><select value={roleKey} onChange={(event) => setRoleKey(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold outline-none focus:border-[#7da797]">{roleOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/55 p-3.5"><div className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /><div><p className="text-xs font-bold text-emerald-900">{selectedRole?.[1]}</p><p className="mt-1 text-xs leading-5 text-emerald-800/75">{selectedRole?.[2]}. Final authority remains subject to active membership, matter access, ethical walls and server authorization.</p></div></div></div>
            <label className="block"><span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Invitation expiry</span><select value={lifetimeHours} onChange={(event) => setLifetimeHours(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none"><option value="24">24 hours</option><option value="72">3 days</option><option value="168">7 days</option><option value="336">14 days</option><option value="720">30 days</option></select></label>
          </div>
          <button disabled={submitting || !email.trim()} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#082b22] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}{submitting ? "Creating invitation…" : "Create governed invitation"}</button>
          {latestInviteUrl ? <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-3"><p className="text-[9px] font-black uppercase tracking-[0.13em] text-amber-700">One-time invitation link</p><div className="mt-2 flex gap-2"><input readOnly value={latestInviteUrl} className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-slate-600" /><button type="button" onClick={() => void copyInvite()} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-900 px-3 py-2 text-xs font-bold text-white">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy"}</button></div></div> : null}
        </form>

        <div className="rounded-[1.4rem] border border-slate-200 bg-white p-4 md:p-5">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.17em] text-slate-400">Invitation ledger</p><h3 className="mt-1 text-base font-bold text-slate-950">Access lifecycle</h3></div><button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh</button></div>
          {error ? <div className="mt-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div> : null}
          {message ? <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">{message}</div> : null}
          <div className="mt-4 space-y-2">
            {loading ? <div className="grid min-h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-[#0b493b]" /></div> : invitations.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-5 text-center text-sm text-slate-500">No invitations have been issued by this firm yet.</div> : invitations.map((invitation) => <InvitationRow key={invitation.id} invitation={invitation} busy={busyId === invitation.id} revoke={revoke} resend={resend} />)}
          </div>
        </div>
      </div>
    </section>
  );
}

function InvitationRow({ invitation, busy, revoke, resend }: { invitation: Invitation; busy: boolean; revoke: (id: string) => Promise<void>; resend: (invitation: Invitation) => Promise<void> }) {
  const expired = invitation.status === "pending" && new Date(invitation.expires_at).getTime() <= Date.now();
  const effectiveStatus = expired ? "expired" : invitation.status;
  const tone = effectiveStatus === "accepted" ? "bg-emerald-50 text-emerald-700" : effectiveStatus === "pending" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500";
  const pending = effectiveStatus === "pending";
  return <div className="flex flex-col gap-3 rounded-xl border border-slate-100 px-3.5 py-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold text-slate-900">{invitation.email}</p><span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] ${tone}`}>{effectiveStatus}</span></div><p className="mt-1 text-[10px] text-slate-400">{roleLabel(invitation.role_key)} · created {formatDate(invitation.created_at)} · expires {formatDate(invitation.expires_at)}</p></div><div className="flex shrink-0 gap-2">{pending || expired ? <button disabled={busy} onClick={() => void resend(invitation)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-slate-600"><RefreshCw className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} /> Refresh</button> : null}{pending ? <button disabled={busy} onClick={() => void revoke(invitation.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 px-2.5 py-1.5 text-[10px] font-bold text-red-600"><XCircle className="h-3 w-3" /> Revoke</button> : null}</div></div>;
}

function MiniMetric({ value, label, icon: Icon }: { value: number; label: string; icon: typeof Clipboard }) {
  return <div className="min-w-24 rounded-xl border border-slate-200 bg-[#fbfcfb] px-3 py-2.5"><Icon className="h-3.5 w-3.5 text-[#0b493b]" /><p className="mt-2 text-lg font-semibold text-slate-950">{value}</p><p className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p></div>;
}

function roleLabel(key: string) {
  return roleOptions.find(([value]) => value === key)?.[1] ?? key.replaceAll("_", " ");
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
