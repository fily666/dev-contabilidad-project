import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    dirs: ["src"],
  },
  experimental: {
    serverActions: {
      // Los soportes documentales se limitan a 20 MB (Contexto.md RF-42) y se
      // suben de uno en uno, asi que el cuerpo nunca lleva mas de un archivo.
      bodySizeLimit: "21mb",
    },
  },
};

export default nextConfig;
