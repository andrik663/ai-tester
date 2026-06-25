import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// Static asset / internal Next.js path prefixes
const BYPASS_PREFIXES = ['/_next', '/favicon', '/icon', '/apple-icon', '/robots']

function isStatic(pathname: string): boolean {
  if (BYPASS_PREFIXES.some((p) => pathname.startsWith(p))) return true
  if (/\.(png|svg|ico|webmanifest|xml|txt|css|js|woff2?)$/.test(pathname)) return true
  return false
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (isStatic(pathname)) return NextResponse.next()
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
