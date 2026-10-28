import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_TOKEN_COOKIE, readSession } from '@/lib/access-token';

// Залогиненному пользователю регистрация не нужна: уводим на главную до рендера страницы.
// Проверка оптимистичная, по cookie: доступ к данным проверяет api.
export function proxy(request: NextRequest) {
  // Server Action формы регистрации приходит на этот же путь POST-запросом: его не трогаем.
  if (
    request.method === 'GET' &&
    readSession(request.cookies.get(ACCESS_TOKEN_COOKIE)?.value)
  ) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/register',
};
