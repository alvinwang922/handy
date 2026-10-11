import type { NextConfig } from "next";

// No cacheComponents: route handlers must run at request time (they poll Dial and read a JSON store).
const nextConfig: NextConfig = {
  // The front page is the Look B app chooser (public/app/index.html).
  async rewrites() {
    return [{ source: "/", destination: "/app/index.html" }];
  },
};

export default nextConfig;
