import { betterAuth } from 'better-auth'
import { pool } from '@/lib/db'

const staticTrustedOrigins = [
  // Local development
  'http://localhost:3000',
  'http://localhost',
  // v0 preview iframes — wildcard covers all branch preview URLs
  'https://*.vusercontent.net',
  ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
    : []),
]

export const auth = betterAuth({
  database: pool,
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.V0_RUNTIME_URL),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  // trustedOrigins also accepts an async function — use it as fallback to
  // dynamically allow any *.vusercontent.net origin that arrives at runtime.
  trustedOrigins: async (request) => {
    const origin = request?.headers?.get('origin') ?? ''
    const extras: string[] = []
    if (origin && origin.endsWith('.vusercontent.net')) {
      extras.push(origin)
    }
    return [...staticTrustedOrigins, ...extras]
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,      // 1 day
  },
  ...(process.env.NODE_ENV === 'development'
    ? {
        advanced: {
          defaultCookieAttributes: {
            sameSite: 'none' as const,
            secure: true,
          },
        },
      }
    : {}),
})
