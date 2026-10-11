import type { NextConfig } from "next";

// No cacheComponents: route handlers must run at request time (they poll Dial and read a JSON store).
const nextConfig: NextConfig = {
  // Alvin's vanilla prototype UI lives at public/index.html and is the app's front page.
  async rewrites() {
    return [{ source: "/", destination: "/index.html" }];
  },
};

export default nextConfig;
