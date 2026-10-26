# video-meetings

Монорепозиторий на [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces) и [Turborepo](https://turborepo.com).

| Приложение | Путь       | Стек                                                         | Порт |
| ---------- | ---------- | ------------------------------------------------------------ | ---- |
| `web`      | `apps/web` | Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4 | 3000 |
| `api`      | `apps/api` | NestJS 12 (ESM), Prisma 7, Vitest                            | 4000 |

## Требования

- Node.js 24: версия указана в `.nvmrc`, переключиться можно командой `nvm use`.
- npm 11 (идёт вместе с Node 24). Точная версия зафиксирована в поле `packageManager`.
- Docker с Compose: для локальной базы данных PostgreSQL.

## Быстрый старт

```bash
nvm use
npm install
npm run dev
```

## База данных

PostgreSQL 18 поднимается через `docker-compose.yml` в корне. Данные хранятся в именованном томе `postgres-data`.

```bash
docker compose up -d --wait   # запустить и дождаться healthcheck
docker compose down           # остановить (данные сохраняются)
docker compose down -v        # остановить и удалить данные
```

Параметры по умолчанию: пользователь `postgres`, пароль `postgres`, база `video_meetings`, порт `5432`. Чтобы изменить, скопируйте `.env.example` в `.env`. Строка подключения: `postgresql://postgres:postgres@localhost:5432/video_meetings`. Приложение `api` подключается к базе через Prisma по `DATABASE_URL` из корневого `.env` (шаблон в `.env.example`, там же `JWT_SECRET`). После `docker compose up` примените миграции: `npm run db:deploy -w api`. Тесты `test:e2e` работают с этой же базой и создают в ней пользователей `user-<uuid>@example.com`.

## Команды

Запускаются из корня. Turborepo выполняет задачу во всех приложениях параллельно и кэширует результат.

| Команда                           | Что делает                         |
| --------------------------------- | ---------------------------------- |
| `npm run dev`                     | dev-режим обоих приложений         |
| `npm run build`                   | production-сборка                  |
| `npm start`                       | сборка и запуск production-версий  |
| `npm run lint` / `lint:fix`       | ESLint: проверка / автоисправление |
| `npm run check-types`             | проверка типов TypeScript          |
| `npm test`                        | unit-тесты (Vitest)                |
| `npm run test:e2e`                | e2e-тесты API                      |
| `npm run format` / `format:check` | Prettier по всему репозиторию      |

Задача только для одного приложения: `npm run dev -- --filter=web`.
Скрипт приложения напрямую, без Turborepo: `npm run test:watch -w api`.

## Структура

```text
apps/
  web/      Next.js
  api/      NestJS
packages/   общие пакеты (подключены в workspaces, пока пусто)
docker-compose.yml   локальный PostgreSQL
```

## Соглашения

- **Prettier.** Один конфиг (`.prettierrc`) и одна версия на весь репозиторий, запускается из корня.
- **ESLint.** Свой flat-конфиг в каждом приложении (`eslint.config.mjs`) плюс `eslint-config-prettier`, чтобы правила ESLint не конфликтовали с Prettier. В `web` стоит ESLint 9, потому что `eslint-config-next` пока не поддерживает 10. В `api` стоит ESLint 10.
- **Зависимости.** npm не запускает install-скрипты пакетов, пока они не перечислены в `allowScripts` корневого `package.json`.
- **Переменные окружения.** Turborepo работает в strict-режиме: задачи видят только те переменные из shell, что перечислены в `turbo.json` (`env` / `globalEnv`). Например, `PORT=5000 npm run dev` порт не изменит. `.env`-файлы приложения читают сами, это ограничение их не касается.
- **CQRS в api.** Контроллеры только отправляют команду или запрос в шину `@nestjs/cqrs`, логика живёт в обработчиках. Подробные правила — в `apps/api/CLAUDE.md`.
