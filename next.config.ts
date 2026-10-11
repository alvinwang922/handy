import type { NextConfig } from "next";

// No cacheComponents: route handlers must run at request time (they poll Dial and read a JSON store).
const nextConfig: NextConfig = {
  // The Look B web app (public/app/*) is the front page; its demo API is app/api/[...lookb].
  // public/ does not resolve directory index files, so /app needs explicit rewrites.
  // Alvin's original prototype stays reachable at /index.html.
  // Vercel serves public/index.html at "/" before rewrites run, so "/" is a redirect.
  async redirects() {
    return [{ source: "/", destination: "/app", permanent: false }];
  },
  async rewrites() {
    return [
      { source: "/app", destination: "/app/index.html" },
      { source: "/app/", destination: "/app/index.html" },
    ];
  },
};

export default nextConfig;
