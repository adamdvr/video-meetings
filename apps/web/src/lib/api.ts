// Адрес api для серверного кода web. Браузер в api напрямую не ходит.
export const API_URL = process.env.API_URL ?? 'http://localhost:4000';

// Без таймаута зависший api подвесил бы и Server Action, и страницу пользователя.
export function apiFetch(path: string, init?: RequestInit) {
  return fetch(`${API_URL}${path}`, {
    signal: AbortSignal.timeout(10_000),
    ...init,
  });
}

export const authHeader = (token: string) => ({
  authorization: `Bearer ${token}`,
});

export async function readJson(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  return typeof body === 'object' && body !== null
    ? (body as Record<string, unknown>)
    : {};
}
