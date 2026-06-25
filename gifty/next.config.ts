import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.137.9",
    "192.168.137.50",
  ],
};

export default nextConfig;
