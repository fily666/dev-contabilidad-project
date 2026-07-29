import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    dirs: ["src"],
  },
  experimental: {
    serverActions: {
      // Los soportes documentales se limitan a 10 MB (Contexto.md RF-42).
      bodySizeLimit: "11mb",
    },
  },
};

export default nextConfig;
