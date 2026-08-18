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
  async headers() {
    return [
      {
        // Cross-origin isolation is required for @webcontainer/api (uses
        // SharedArrayBuffer under the hood) to boot the "Full Project"
        // preview sandbox in-browser.
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ]
  },
}

export default nextConfig
