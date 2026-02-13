/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { 
    unoptimized: true,
  },
  // For Cloudflare Pages deployment
  output: 'export',
  // Disable features not compatible with static export
  trailingSlash: true,
};

module.exports = nextConfig;
