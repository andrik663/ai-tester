import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// Routes that are publicly accessible without authentication
const PUBLIC_PATHS = ['/login', '/api/dev/login', '/api/dev/logout', '/api/dev/me']

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

  // Dev login uses a simple session cookie set by /api/dev/login
  const devSession = request.cookies.get('dev_session')?.value
  const exportToken = request.headers.get('x-export-token') // for API-to-API calls

  // Cookie must be non-empty (actual value check happens server-side in the route)
  if (!devSession && !exportToken) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
