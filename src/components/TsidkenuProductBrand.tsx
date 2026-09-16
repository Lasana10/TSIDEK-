"use client";

import { usePathname } from "next/navigation";
import { TSIDKENU_PRODUCT_LOGO } from "@/lib/tsidkenu-brand";

export default function TsidkenuProductBrand() {
  const pathname = usePathname();

  if (pathname === "/workspace" || pathname.startsWith("/workspace/")) {
    return (
      <div className="pointer-events-none fixed left-4 top-3 z-[70] hidden h-[76px] w-[190px] items-center overflow-hidden rounded-2xl bg-[#082b22] px-2 xl:flex">
        <img
          src={TSIDKENU_PRODUCT_LOGO}
          alt="Tsidkenu"
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

  if (pathname === "/auth" || pathname.startsWith("/auth/") || pathname === "/onboarding") {
    return (
      <div className="pointer-events-none fixed left-1/2 top-3 z-[70] h-[64px] w-[150px] -translate-x-1/2 overflow-hidden rounded-2xl bg-[#10291e] px-2 shadow-lg sm:h-[76px] sm:w-[180px]">
        <img
          src={TSIDKENU_PRODUCT_LOGO}
          alt="Tsidkenu"
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

  return null;
}
