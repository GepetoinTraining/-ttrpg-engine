import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // pdfjs-dist's legacy build self-resolves its worker; let Node load it
  // directly rather than letting Turbopack bundle/relocate it.
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
