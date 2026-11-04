import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@saturn/model", "@saturn/geometry", "@saturn/analyses"],
  reactStrictMode: true,
};

export default nextConfig;
