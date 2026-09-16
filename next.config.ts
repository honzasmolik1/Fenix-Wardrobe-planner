import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Hide the bottom-left Next.js "N" badge — it sits on the dock and
  // looks like a stray "3-drawer" toast after adding fittings.
  devIndicators: false,
  turbopack: {
    resolveAlias: {
      canvas: "./src/lib/canvasStub.ts",
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
};

export default nextConfig;
