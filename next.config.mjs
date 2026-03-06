/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['mammoth', 'xlsx', 'jszip', 'pdf-parse'],
    // Server Actions body 크기 제한 (App Router)
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
