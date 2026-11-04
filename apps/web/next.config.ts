import type { NextConfig } from "next";
import webpack from "webpack";

const nextConfig: NextConfig = {
  transpilePackages: ["@saturn/model", "@saturn/geometry", "@saturn/analyses", "@saturn/realtime"],
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // rhino3dm ships a universal bundle that references Node built-ins with the node: scheme; stub them in the browser.
    config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^node:/, (res: { request: string }) => { res.request = res.request.replace(/^node:/, ""); }));
    if (!isServer) config.resolve.fallback = { ...(config.resolve.fallback ?? {}), fs: false, path: false, crypto: false, module: false, url: false };
    return config;
  },
};

export default nextConfig;
