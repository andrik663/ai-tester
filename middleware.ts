import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// Middleware runs on Node.js runtime (not Edge) to avoid pg/better-auth import conflicts
export const runtime = 'nodejs'

// Routes that are publicly accessible without authentication
const PUBLIC_PATHS = ['/login', '/api/auth']

// Static asset / internal Next.js path prefixes that bypass auth
const BYPASS_PREFIXES = ['/_next', '/favicon', '/icon', '/apple-icon', '/robots']

function isPublic(pathname: string): boolean {
  if (BYPASS_PREFIXES.some((p) => pathname.startsWith(p))) return true
  if (/\.(png|svg|ico|webmanifest|xml|txt|css|js|woff2?)$/.test(pathname)) return true
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  // Better Auth sets "better-auth.session_token" (dev) or "__Secure-better-auth.session_token" (prod)
  const sessionCookie =
    request.cookies.get('better-auth.session_token') ??
    request.cookies.get('__Secure-better-auth.session_token')

  if (!sessionCookie?.value) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
