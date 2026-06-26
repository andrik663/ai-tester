import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { verifySession, COOKIE_NAME } from '@/lib/auth'

// Paths that are always public — no auth required
const PUBLIC_PREFIXES = [
  '/_next',
  '/favicon',
  '/icon',
  '/apple-icon',
  '/robots',
  '/login',
  '/api/auth',   // /api/auth/login and /api/auth/logout
]

function isPublic(pathname: string): boolean {
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true
  if (/\.(png|svg|ico|webmanifest|xml|txt|css|js|woff2?)$/.test(pathname)) return true
  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow public paths
  if (isPublic(pathname)) return NextResponse.next()

  // If DEV_PASSWORD is not set, allow through (dev environment without config)
  if (!process.env.DEV_PASSWORD) return NextResponse.next()

  const sessionCookie = request.cookies.get(COOKIE_NAME)?.value
  const authenticated = await verifySession(sessionCookie)

  if (!authenticated) {
    // API requests get a 401 JSON response
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Page requests redirect to login
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
