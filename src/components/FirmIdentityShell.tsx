"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { LanguageSwitcher } from "@/components/LocaleProvider";

type Brand = {
  display_name?: string;
  short_name?: string;
  motto?: string;
  logo_display_url?: string;
  primary_color?: string;
  accent_color?: string;
};

export default function FirmIdentityShell() {
  const [brand, setBrand] = useState<Brand | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/firm/studio", { cache: "no-store", credentials: "include" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (active && payload?.success && payload.brand) setBrand(payload.brand);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  if (!brand) return null;
  const name = brand.display_name || brand.short_name || "Your Firm";

  return (
    <div className="firm-identity-shell" style={{ borderColor: `color-mix(in srgb, ${brand.primary_color || "#003629"} 18%, transparent)` }}>
      <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-4 px-4 py-2.5 md:px-7 xl:px-10">
        <Link href="/workspace" className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
            {brand.logo_display_url ? <img src={brand.logo_display_url} alt={`${name} logo`} className="h-full w-full object-contain p-1.5" /> : <Building2 className="h-5 w-5" style={{ color: brand.primary_color || "#003629" }} />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
            {brand.motto ? <p className="truncate text-[10px] font-medium text-slate-500">{brand.motto}</p> : <p className="text-[10px] font-medium text-slate-400">Firm workspace</p>}
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher compact className="hidden sm:inline-flex" />
          <span className="hidden h-2 w-2 rounded-full sm:inline-block" style={{ background: brand.accent_color || "#c5a059" }} />
          <span className="hidden text-[9px] font-black uppercase tracking-[.16em] text-slate-400 md:inline">Powered by TSIDKENU</span>
        </div>
      </div>
    </div>
  );
}
