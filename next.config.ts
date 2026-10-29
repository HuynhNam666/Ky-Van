import type { NextConfig } from 'next';

// 'standalone' is for the Docker image; Vercel produces its own output and
// fails on the standalone trace (missing next-server.js.nft.json).
const nextConfig: NextConfig = {
  ...(process.env.VERCEL ? {} : { output: 'standalone' as const }),
  async rewrites() {
    return [{ source: '/api/:path*', destination: (process.env.BACKEND_URL || 'http://backend:8000') + '/api/:path*' }];
  },
};
export default nextConfig;
