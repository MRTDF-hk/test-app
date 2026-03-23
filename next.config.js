/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pdf-parse'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api-inference.huggingface.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
}

module.exports = nextConfig
