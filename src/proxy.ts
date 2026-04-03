import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/lib/session-constants';

const PUBLIC_PATHS = ['/login', '/api/auth/send-otp', '/api/auth/verify-otp', '/api/webhooks'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/robots.txt' ||
    pathname === '/manifest.json'
  ) {
    return NextResponse.next();
  }

  // Root redirect
  if (pathname === '/') {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    return NextResponse.redirect(new URL(token ? '/home' : '/login', req.url));
  }

  // Protect app routes — token presence check only (full validation happens in getSession)
  if (pathname.startsWith('/home') ||
      pathname.startsWith('/garage') ||
      pathname.startsWith('/book') ||
      pathname.startsWith('/bookings') ||
      pathname.startsWith('/help') ||
      pathname.startsWith('/profile') ||
      pathname.startsWith('/tracker')) {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
