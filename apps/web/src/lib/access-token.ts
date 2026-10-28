// Имя cookie, в которой лежит JWT, выданный api. Здесь только разбор токена без next/headers,
// чтобы им мог пользоваться и proxy, и серверные компоненты.
export const ACCESS_TOKEN_COOKIE = 'access_token';

export type Session = { email: string };

type TokenClaims = { email?: unknown; exp?: unknown };

// Подпись не проверяем: токен выдал api, а при каждом запросе его проверяет он же.
function decodeClaims(token: string): TokenClaims | null {
  try {
    const payload = Buffer.from(token.split('.')[1], 'base64url').toString();
    const claims: unknown = JSON.parse(payload);
    return typeof claims === 'object' && claims !== null ? claims : null;
  } catch {
    return null;
  }
}

export function getTokenExpiry(token: string) {
  const exp = decodeClaims(token)?.exp;
  return typeof exp === 'number' ? new Date(exp * 1000) : undefined;
}

// Сессия для интерфейса: решает, что показать (форму регистрации или «вы вошли как …»).
// Это оптимистичная проверка по cookie, доступ к данным она не защищает: его проверяет api.
export function readSession(token: string | undefined): Session | null {
  if (!token) return null;
  const email = decodeClaims(token)?.email;
  if (typeof email !== 'string') return null;
  const expiry = getTokenExpiry(token);
  if (expiry && expiry.getTime() <= Date.now()) return null;
  return { email };
}
