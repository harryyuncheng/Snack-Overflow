import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // drei <Html> overlays double-unmount under StrictMode in dev
  reactStrictMode: false,
  /* config options here */
};

export default nextConfig;
