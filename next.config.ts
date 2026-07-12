import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
    resolveAlias: {
      "framer-motion": "./src/lib/framer-motion-shim.tsx",
    },
  },
};

export default nextConfig;
