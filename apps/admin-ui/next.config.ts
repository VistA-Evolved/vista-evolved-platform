import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: false,
  async rewrites() {
    // Proxy API calls to backend services.
    // /api/ta/v1/* -> http://127.0.0.1:4520/api/tenant-admin/v1/*
    // /api/op/v1/* -> http://127.0.0.1:4510/api/control-plane/v1/*
    return [
      {
        source: '/api/ta/v1/:path*',
        destination: 'http://127.0.0.1:4520/api/tenant-admin/v1/:path*',
      },
      {
        source: '/api/op/v1/:path*',
        destination: 'http://127.0.0.1:4510/api/control-plane/v1/:path*',
      },
    ];
  },
};

export default nextConfig;
