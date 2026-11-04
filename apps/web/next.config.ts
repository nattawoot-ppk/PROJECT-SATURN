import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@saturn/model", "@saturn/geometry"],
  reactStrictMode: true,
};

export default nextConfig;
