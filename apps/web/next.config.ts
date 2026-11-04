import type { NextConfig } from "next";
import webpack from "webpack";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const nextConfig: NextConfig = {
  // Static export (output: "export") lets the whole editor run from any static host or CDN; the API is optional.
  output: process.env.NEXT_STATIC_EXPORT ? "export" : undefined,
  basePath: basePath || undefined,
  trailingSlash: !!process.env.NEXT_STATIC_EXPORT,
  images: { unoptimized: true },
  // Same-origin API proxy for single-port hosting and previews: set API_PROXY=http://localhost:4000 and NEXT_PUBLIC_API_URL=/api
  async rewrites() { const t = process.env.API_PROXY; return t ? [{ source: "/api/:path*", destination: `${t}/:path*` }] : []; },
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
