import path from 'node:path';

import type { NextConfig } from 'next';

import { PRIVATE_CACHE_HEADERS, SECURITY_HEADERS } from './lib/security-headers';

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  trailingSlash: false,
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
      {
        source: '/dashboard/:path*',
        headers: PRIVATE_CACHE_HEADERS,
      },
      {
        source: '/api/:path*',
        headers: PRIVATE_CACHE_HEADERS,
      },
      {
        source: '/login',
        headers: PRIVATE_CACHE_HEADERS,
      },
      {
        source: '/auth/:path*',
        headers: PRIVATE_CACHE_HEADERS,
      },
      {
        source: '/cli/:path*',
        headers: PRIVATE_CACHE_HEADERS,
      },
    ];
  },
};

export default nextConfig;
