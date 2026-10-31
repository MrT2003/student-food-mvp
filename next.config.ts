import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // OAuth callbacks contain single-use credentials in the query string.
  logging: { incomingRequests: { ignore: [/\/api\/auth\/zalo(?:\/|\?)/] } },
};

export default nextConfig;
