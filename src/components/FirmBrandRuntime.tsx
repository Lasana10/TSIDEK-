"use client";

import { useEffect } from "react";
import { TSIDKENU_PRODUCT_LOGO } from "@/lib/tsidkenu-brand";

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

function ensureFavicon(href: string, source: "product" | "firm") {
  let icon = document.querySelector<HTMLLinkElement>('link[data-tsidkenu-favicon="true"]');
  if (!icon) {
    icon = document.createElement("link");
    icon.rel = "icon";
    icon.dataset.tsidkenuFavicon = "true";
    document.head.appendChild(icon);
  }
  icon.dataset.source = source;
  icon.href = href;
}

export default function FirmBrandRuntime() {
  useEffect(() => {
    let active = true;
    ensureFavicon(TSIDKENU_PRODUCT_LOGO, "product");

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
        document.title = brand.display_name ? `${brand.display_name} · TSIDKENU` : "TSIDKENU · Legal Operating System";

        // Firm branding can override the favicon for white-labelled deployments.
        // Otherwise the TSIDKENU product mark remains the default identity.
        if (brand.logo_display_url) ensureFavicon(brand.logo_display_url, "firm");
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  return null;
}
