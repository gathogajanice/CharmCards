import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Allow importing from api directory for serverless functions
      config.resolve.modules = [
        ...(config.resolve.modules || []),
        path.resolve(__dirname, '..'),
      ];
    }
    return config;
  },
  // Note: Turbopack handles dependencies differently than webpack
  // Optional wallet dependencies should be installed if needed
} as NextConfig;

export default nextConfig;
