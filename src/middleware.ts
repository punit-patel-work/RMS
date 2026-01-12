import { NextRequest, NextResponse } from 'next/server';

// Simple middleware without NextAuth - handles basic route protection
// Full auth checks are done in server components via auth()
export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Allow all API routes, static files, and login page
    if (
        pathname.startsWith('/api') ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon') ||
        pathname === '/login'
    ) {
        return NextResponse.next();
    }

    // For dashboard routes, we'll check auth in the layout/page components
    // This middleware just ensures basic routing works
    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
