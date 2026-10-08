import { NextResponse, type NextRequest } from 'next/server';

/**
 * Next.js Middleware: Route Protection
 * Protects dashboard and merchant management pages against unauthenticated access.
 * Allows public storefront routes, embed widget, auth pages, static assets, and API routes.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow public storefront, embedded widgets, auth pages, static assets, and API routes
  if (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/ai-mode/embed') ||
    pathname === '/ai-mode/search' // Public customer AI search storefront
  ) {
    return NextResponse.next();
  }

  // 2. Check for httpOnly access_token or fallback aaas_token cookie
  const accessToken = request.cookies.get('access_token')?.value || request.cookies.get('aaas_token')?.value;

  if (!accessToken) {
    // Redirect unauthenticated user to login with original target path
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
