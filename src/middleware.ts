import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

function isLocalHost(hostHeader: string | null): boolean {
  if (!hostHeader) return false
  const hostname = hostHeader.split(':')[0]?.toLowerCase() ?? ''
  return LOCAL_HOSTS.has(hostname)
}

function isAllowedPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith('/api/cron/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/icon.svg' ||
    pathname === '/manifest.webmanifest'
  )
}

export function middleware(request: NextRequest) {
  const lockdownEnabled = process.env.LOCKDOWN_PROD_SITE === 'true'
  const isProduction = process.env.NODE_ENV === 'production'

  if (!lockdownEnabled || !isProduction) {
    return NextResponse.next()
  }

  if (isLocalHost(request.headers.get('host'))) {
    return NextResponse.next()
  }

  if (isAllowedPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next()
  }

  return new NextResponse('Not Found', { status: 404 })
}

export const config = {
  matcher: ['/((?!.*\\..*).*)', '/api/:path*', '/favicon.ico', '/icon.svg', '/manifest.webmanifest'],
}
