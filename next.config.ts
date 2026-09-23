import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
      cacheLife: {
          minutes: {
              stale: 300,
              revalidate: 300,
              expire: 300,
          },
      },
  },
  // If next.js expects it at top level:
  cacheComponents: true,
};

export default nextConfig;
