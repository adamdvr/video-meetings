# video-meetings

Монорепозиторий на [pnpm workspaces](https://pnpm.io/workspaces) и [Turborepo](https://turborepo.com).

| Приложение | Путь       | Стек                                                         | Порт |
| ---------- | ---------- | ------------------------------------------------------------ | ---- |
| `web`      | `apps/web` | Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4 | 3000 |
| `api`      | `apps/api` | NestJS 12 (ESM), Vitest                                      | 4000 |

## Требования

- Node.js 24: версия указана в `.nvmrc`, переключиться можно командой `nvm use`.
- pnpm 12: `npm install -g pnpm@12`. Точная версия зафиксирована в поле `packageManager`.
- Docker с Compose: для локальной базы данных PostgreSQL.

## Быстрый старт

```bash
nvm use
pnpm install
pnpm dev
```

## База данных

PostgreSQL 18 поднимается через `docker-compose.yml` в корне. Данные хранятся в именованном томе `postgres-data`.

```bash
docker compose up -d --wait   # запустить и дождаться healthcheck
docker compose down           # остановить (данные сохраняются)
docker compose down -v        # остановить и удалить данные
```

Параметры по умолчанию: пользователь `postgres`, пароль `postgres`, база `video_meetings`, порт `5432`. Чтобы изменить, скопируйте `.env.example` в `.env`. Строка подключения: `postgresql://postgres:postgres@localhost:5432/video_meetings`. Приложение `api` к базе пока не подключено.

## Команды

Запускаются из корня. Turborepo выполняет задачу во всех приложениях параллельно и кэширует результат.

| Команда                             | Что делает                         |
| ----------------------------------- | ---------------------------------- |
| `pnpm dev`                          | dev-режим обоих приложений         |
| `pnpm build`                        | production-сборка                  |
| `pnpm start`                        | сборка и запуск production-версий  |
| `pnpm lint` / `pnpm lint:fix`       | ESLint: проверка / автоисправление |
| `pnpm check-types`                  | проверка типов TypeScript          |
| `pnpm test`                         | unit-тесты (Vitest)                |
| `pnpm test:e2e`                     | e2e-тесты API                      |
| `pnpm format` / `pnpm format:check` | Prettier по всему репозиторию      |

Задача только для одного приложения: `pnpm dev --filter=web`.
Скрипт приложения напрямую, без Turborepo: `pnpm --filter api test:watch`.

## Структура

```text
apps/
  web/      Next.js
  api/      NestJS
packages/   общие пакеты (подключены в pnpm-workspace.yaml, пока пусто)
docker-compose.yml   локальный PostgreSQL
```

## Соглашения

- **Prettier.** Один конфиг (`.prettierrc`) и одна версия на весь репозиторий, запускается из корня.
- **ESLint.** Свой flat-конфиг в каждом приложении (`eslint.config.mjs`) плюс `eslint-config-prettier`, чтобы правила ESLint не конфликтовали с Prettier. В `web` стоит ESLint 9, потому что `eslint-config-next` пока не поддерживает 10. В `api` стоит ESLint 10.
- **Зависимости.** pnpm не запускает install-скрипты пакетов, пока они не перечислены в `allowBuilds` (`pnpm-workspace.yaml`). Версии, опубликованные меньше суток назад, pnpm не устанавливает.
- **Переменные окружения.** Turborepo работает в strict-режиме: задачи видят только те переменные из shell, что перечислены в `turbo.json` (`env` / `globalEnv`). Например, `PORT=5000 pnpm dev` порт не изменит. `.env`-файлы приложения читают сами, это ограничение их не касается.
