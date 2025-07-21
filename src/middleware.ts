import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Only protect these paths
  const protectedPaths = ['/', '/packs', '/purchase', '/purchase-history', '/chat', '/chats'];
  const { pathname } = request.nextUrl;

  // If the path is protected and no access_token cookie, redirect to /login
  if (
    protectedPaths.some((path) => pathname === path) &&
    !request.cookies.get('access_token')
  ) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Otherwise, allow
  return NextResponse.next();
}

// Apply middleware to all routes except /login and /_next
export const config = {
  matcher: ['/', '/packs', '/((?!_next|login|api|favicon.ico).*)'],
}; 