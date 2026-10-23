/** @type {import('next').NextConfig} */
const nextConfig = {
  // Imagen Docker liviana. En Windows sin modo desarrollador los symlinks fallan, por eso es opcional.
  output: process.env.NEXT_STANDALONE === 'true' ? 'standalone' : undefined,
  transpilePackages: ['@tendia/tokens'],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
