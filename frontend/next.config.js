/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Avoid blocking builds due to lint issues in production
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Avoid blocking builds due to type checking issues in production
    ignoreBuildErrors: true,
  }
};

module.exports = nextConfig;
