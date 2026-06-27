import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3: native addon, must not be bundled
  // esbuild: uses native binaries + dynamic require, must not be bundled
  serverExternalPackages: ["better-sqlite3", "esbuild"],
};

export default nextConfig;
