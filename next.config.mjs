/** @type {import('next').NextConfig} */
const nextConfig = {
  // pg-cloudflare HARUS dieksternalisasi dari bundle server: adapter
  // @opennextjs/cloudflare hanya menyalin UTUH paket yang memakai kondisi
  // ekspor "workerd" bila paket itu ada di serverExternalPackages
  // (copyWorkerdPackages). Tanpa ini, pelacak file hanya menyalin stub
  // default (dist/empty.js) dan dist/index.js versi workerd tidak pernah
  // masuk ke bundle, sehingga esbuild gagal "Could not resolve
  // pg-cloudflare" di Worker. Di runtime Node (Vercel), pg tidak pernah
  // memanggil jalur Cloudflare ini, jadi tidak ada perubahan perilaku.
  serverExternalPackages: ["pg-cloudflare"],
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
