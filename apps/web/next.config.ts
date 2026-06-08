import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Local API server — vehicle photos served by Express in development
      { protocol: "http", hostname: "localhost", port: "3001", pathname: "/uploads/**" },
      // Production API — override NEXT_PUBLIC_API_URL to point here
      { protocol: "https", hostname: "**", pathname: "/uploads/**" },
    ],
  },
};

export default nextConfig;
