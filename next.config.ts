import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cho phép tunnel hiện tại tải tài nguyên dev/HMR; đổi hostname nếu URL ngrok thay đổi.
  allowedDevOrigins: ["rename-headrest-contrite.ngrok-free.dev"],
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
