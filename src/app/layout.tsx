import type { Metadata } from "next";
import "./globals.css";
import FirmBrandRuntime from "@/components/FirmBrandRuntime";
import FirmIdentityShell from "@/components/FirmIdentityShell";
import TsidkenuProductBrand from "@/components/TsidkenuProductBrand";
import LocaleProvider from "@/components/LocaleProvider";

export const metadata: Metadata = {
  title: "TSIDKENU · Legal Operating System",
  description: "TSIDKENU legal operating system for matter-centric, source-preserving and governed legal work.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <LocaleProvider>
          <FirmBrandRuntime />
          <FirmIdentityShell />
          <TsidkenuProductBrand />
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
