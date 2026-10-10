/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export for S3 + CloudFront (cost-optimized AWS hosting)
  output: process.env.OUTFITLENS_STATIC_EXPORT === '1' ? 'export' : undefined,
  images: { unoptimized: true },
  trailingSlash: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
