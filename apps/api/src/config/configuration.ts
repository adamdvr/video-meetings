import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Переменные окружения лежат в корневом .env (рядом с docker-compose.yml).
// Уже заданные в окружении переменные имеют приоритет над файлом.
try {
  process.loadEnvFile(
    fileURLToPath(new URL('../../../../.env', import.meta.url)),
  );
} catch {
  // Файла может не быть (CI, production): тогда всё берётся из окружения.
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Не задана переменная окружения ${name}`);
  }
  return value;
}

export function getConfig() {
  return {
    databaseUrl: required('DATABASE_URL'),
    jwtSecret: required('JWT_SECRET'),
    jwtExpiresInSeconds: Number(
      process.env.JWT_EXPIRES_IN_SECONDS ?? 60 * 60 * 24 * 7,
    ),
    filesDir: resolve(
      process.env.FILES_DIR ||
        fileURLToPath(new URL('../../storage', import.meta.url)),
    ),
  };
}
