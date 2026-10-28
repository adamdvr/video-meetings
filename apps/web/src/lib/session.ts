import { cookies } from 'next/headers';
import { connection } from 'next/server';
import {
  ACCESS_TOKEN_COOKIE,
  getTokenExpiry,
  readSession,
  type Session,
} from './access-token';

// JWT, выданный api, лежит в httpOnly-cookie: браузерному JS он недоступен.
// Серверный код читает его через cookies() и передаёт в api как `Authorization: Bearer`.
export async function createSession(accessToken: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // Cookie живёт столько же, сколько токен (срок задаёт api: JWT_EXPIRES_IN_SECONDS).
    expires: getTokenExpiry(accessToken),
  });
}

// Сессия для интерфейса, см. readSession. При cacheComponents читать cookie можно только внутри <Suspense>.
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  await connection();
  return readSession(cookieStore.get(ACCESS_TOKEN_COOKIE)?.value);
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_TOKEN_COOKIE);
}
