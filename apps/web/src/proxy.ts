import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_TOKEN_COOKIE, readSession } from '@/lib/access-token';

export function proxy(request: NextRequest) {
  // Server Action формы приходит на этот же путь POST-запросом: его не трогаем.
  if (request.method !== 'GET') return NextResponse.next();

  const hasSession = Boolean(
    readSession(request.cookies.get(ACCESS_TOKEN_COOKIE)?.value),
  );
  const { pathname } = request.nextUrl;

  if (pathname === '/' || pathname.startsWith('/meetings/')) {
    return hasSession
      ? NextResponse.next()
      : NextResponse.redirect(new URL('/login', request.url));
  }

  return hasSession
    ? NextResponse.redirect(new URL('/', request.url))
    : NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/meetings/:id',
    '/meetings/:id/((?!files(?:/|$)).*)',
    '/register',
    '/login',
  ],
};
