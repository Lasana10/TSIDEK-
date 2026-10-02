"use client";

import { useEffect, useState } from "react";
import { Copy, FileArchive, QrCode } from "lucide-react";

type Identity = {
  qrDestination: string;
  qrPayload: string;
  barcodeValue: string | null;
  fileCode: string | null;
  verificationStatus: string;
  location: string | null;
  custodyStatus: string | null;
};

export default function CaseIdentityPanel({ matterId }: { matterId: string }) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/matters/${matterId}/qr-destination`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error ?? "Unable to load case identity.");
        if (active) setIdentity(payload.identity);
      })
      .catch((caught) => active && setError(caught instanceof Error ? caught.message : "Unable to load case identity."));
    return () => { active = false; };
  }, [matterId]);

  async function copyDestination() {
    if (!identity) return;
    const absolute = `${window.location.origin}${identity.qrDestination}`;
    await navigator.clipboard.writeText(absolute);
  }

  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[.2em] text-[#0f5b49]">Physical ↔ digital identity</p>
          <h3 className="mt-1 text-lg font-semibold">Case QR & registry identity</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">QR is the primary mobile identity. The barcode/reference remains available for registry scanners and physical archives.</p>
        </div>
        <div className="rounded-xl bg-[#edf4f0] p-2.5 text-[#0b493b]"><QrCode className="h-5 w-5" /></div>
      </div>

      {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p> : null}
      {!identity && !error ? <p className="mt-4 text-sm text-slate-500">Loading case identity…</p> : null}
      {identity ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-[#f7f9f7] p-4">
            <p className="text-[9px] font-black uppercase tracking-[.16em] text-slate-400">QR destination</p>
            <p className="mt-2 break-all text-sm font-semibold text-slate-800">{identity.qrDestination}</p>
            <button onClick={copyDestination} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"><Copy className="h-4 w-4"/>Copy secure route</button>
          </div>
          <div className="rounded-2xl bg-[#f7f9f7] p-4">
            <p className="text-[9px] font-black uppercase tracking-[.16em] text-slate-400">Physical file</p>
            <p className="mt-2 text-sm font-semibold text-slate-800">{identity.fileCode ?? "Not registered"}</p>
            <p className="mt-1 text-xs text-slate-500">{identity.location ?? "Location not recorded"} · {identity.custodyStatus ?? "Custody not recorded"}</p>
            <p className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-slate-600"><FileArchive className="h-4 w-4"/>Barcode: {identity.barcodeValue ?? "Optional / not assigned"}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
