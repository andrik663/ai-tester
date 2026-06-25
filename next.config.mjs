/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    // Required for middleware to run on the Node.js runtime (instead of Edge).
    // This allows middleware to use Node.js modules transitively.
    nodeMiddleware: true,
  },
}

export default nextConfig
