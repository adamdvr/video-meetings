import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_TOKEN_COOKIE, readSession } from '@/lib/access-token';

// Главная доступна только после входа, а регистрация и вход залогиненному не нужны:
// уводим на нужную страницу до её рендера.
// Проверка оптимистичная, по cookie: доступ к данным проверяет api.
export function proxy(request: NextRequest) {
  // Server Action формы приходит на этот же путь POST-запросом: его не трогаем.
  if (request.method !== 'GET') return NextResponse.next();

  const hasSession = Boolean(
    readSession(request.cookies.get(ACCESS_TOKEN_COOKIE)?.value),
  );

  if (request.nextUrl.pathname === '/') {
    return hasSession
      ? NextResponse.next()
      : NextResponse.redirect(new URL('/login', request.url));
  }

  return hasSession
    ? NextResponse.redirect(new URL('/', request.url))
    : NextResponse.next();
}

export const config = {
  matcher: ['/', '/register', '/login'],
};
