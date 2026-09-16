import type { Metadata } from "next";
import "./globals.css";
import FirmBrandRuntime from "@/components/FirmBrandRuntime";

export const metadata: Metadata = {
  title: "TSIDEK OS",
  description: "TSIDEK legal operations workspace for cooperation, case management, and sovereign execution.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full"><FirmBrandRuntime />{children}</body>
    </html>
  );
}
