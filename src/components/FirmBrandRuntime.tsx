"use client";

import { useEffect } from "react";

type BrandPayload = {
  success?: boolean;
  brand?: {
    display_name?: string;
    primary_color?: string;
    secondary_color?: string;
    accent_color?: string;
    background_color?: string;
    surface_color?: string;
    text_color?: string;
    logo_display_url?: string;
  };
};

export default function FirmBrandRuntime() {
  useEffect(() => {
    let active = true;
    fetch("/api/firm/studio", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<BrandPayload> : null)
      .then((data) => {
        if (!active || !data?.success || !data.brand) return;
        const brand = data.brand;
        const root = document.documentElement;
        const values: Record<string, string | undefined> = {
          "--firm-primary": brand.primary_color,
          "--firm-secondary": brand.secondary_color,
          "--firm-accent": brand.accent_color,
          "--firm-background": brand.background_color,
          "--firm-surface": brand.surface_color,
          "--firm-text": brand.text_color,
        };
        for (const [key, value] of Object.entries(values)) if (value) root.style.setProperty(key, value);
        if (brand.display_name) document.title = `${brand.display_name} · TSIDK`;
        if (brand.logo_display_url) {
          let icon = document.querySelector<HTMLLinkElement>('link[data-firm-favicon="true"]');
          if (!icon) {
            icon = document.createElement("link");
            icon.rel = "icon";
            icon.dataset.firmFavicon = "true";
            document.head.appendChild(icon);
          }
          icon.href = brand.logo_display_url;
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  return null;
}
