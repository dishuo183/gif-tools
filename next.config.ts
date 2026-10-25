import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // wasm tools need these off the critical path; nothing here is server-rendered
  reactStrictMode: true,
  // Next 16 blocks dev-only resources (HMR, hydration payload) from origins it
  // did not print. Opening 127.0.0.1 instead of localhost leaves the page
  // unhydrated — every control looks dead and nothing runs. Allow both.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
