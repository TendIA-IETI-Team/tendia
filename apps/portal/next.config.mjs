/** @type {import('next').NextConfig} */
const nextConfig = {
  // Imagen Docker liviana. En Windows sin modo desarrollador los symlinks fallan, por eso es opcional.
  output: process.env.NEXT_STANDALONE === 'true' ? 'standalone' : undefined,
  transpilePackages: ['@tendia/tokens'],
  // En Vercel Services el optimizador (/_next/image) no tiene ruta y responde 404; el portal solo
  // usa el logo, un PNG pequeño, así que se sirve tal cual.
  images: { unoptimized: true },
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
