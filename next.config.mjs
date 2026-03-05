/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['mammoth', 'xlsx', 'jszip', 'pdf-parse'],
  },
};

export default nextConfig;
