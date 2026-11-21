import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentUpgrade: "security",
  },
  // OAuth callbacks contain single-use credentials in the query string.
  logging: { incomingRequests: { ignore: [/\/api\/auth\/zalo(?:\/|\?)/] } },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
