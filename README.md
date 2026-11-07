# video-meetings

Монорепозиторий на [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces) и [Turborepo](https://turborepo.com).

| Приложение | Путь       | Стек                                                                   | Порт |
| ---------- | ---------- | ---------------------------------------------------------------------- | ---- |
| `web`      | `apps/web` | Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4, HeroUI 3 | 3000 |
| `api`      | `apps/api` | NestJS 12 (ESM), Prisma 7, Vitest                                      | 4000 |

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

Параметры по умолчанию: пользователь `postgres`, пароль `postgres`, база `video_meetings`, порт `5432`. Чтобы изменить, скопируйте `.env.example` в `.env`. Строка подключения: `postgresql://postgres:postgres@localhost:5432/video_meetings`. Приложение `api` подключается к базе через Prisma по `DATABASE_URL` из корневого `.env` (шаблон в `.env.example`, там же `JWT_SECRET`). После `docker compose up` примените миграции: `npm run db:deploy -w api`. Тесты `test:e2e` работают с этой же базой, подробности в разделе «Тесты».

## Файлы встреч

Файлы, которые загружают во встречи, `api` хранит на локальном диске, а записи о них — в таблице `meeting_files`. Каталог задаёт `FILES_DIR` в корневом `.env`, по умолчанию это `apps/api/storage`; он исключён из git. Внутри лежат `<id встречи>/<id файла>`, а в `.tmp/` — загрузки, которые ещё идут.

- **Свободное место.** Лимитов на встречу нет, поэтому место контролируется вручную: `df -h apps/api/storage` показывает свободное место на диске, `du -sh apps/api/storage` — сколько заняли файлы. Том PostgreSQL обычно на том же диске: если диск заполнится, остановится и база.
- **Файлы тестов.** E2E-тесты загружают файлы в этот же каталог и не удаляют их, как и тестовых пользователей.
- **Сброс данных.** `docker compose down -v` удаляет базу, но не файлы: после него каталог можно очистить вручную.

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

## Тесты

Тесты есть только в `api` (Vitest 4), у `web` тестового раннера пока нет.

- **Unit** (`apps/api/src/**/*.spec.ts`): `npm test`. Пока ни одного нет, задача проходит и без файлов.
- **E2E** (`apps/api/test/*.e2e-spec.ts`): `npm run test:e2e`. Поднимают приложение целиком, обращаются к нему по HTTP и через шину CQRS, пишут данные в настоящий PostgreSQL, а загруженные файлы — в каталог хранения.

Для e2e нужно то же окружение, что и для `npm run dev`: `nvm use`, корневой `.env` (`cp .env.example .env`, нужны `DATABASE_URL` и `JWT_SECRET`), запущенная база (`docker compose up -d --wait`) и применённые миграции (`npm run db:deploy -w api`).

```bash
npm run test:e2e -w api -- test/auth.e2e-spec.ts           # один файл
npm run test:e2e -w api -- -t "возвращает 409"             # по имени теста
npm run test:e2e -w api -- test/auth.e2e-spec.ts -t "409"  # файл и имя вместе
```

Что нужно знать:

- **Одна база на всё.** E2E-тесты работают с той же базой, что и `npm run dev`, и ничего не удаляют. Тесты, которые что-то создают, берут уникальные данные (`user-<uuid>@example.com`), поэтому не мешают друг другу и вашим данным, но тестовые пользователи и их файлы накапливаются (см. «Файлы встреч»).
- **Кэш Turborepo.** `test` и `test:e2e` кэшируются по файлам проекта, а не по состоянию базы. Повторный запуск из корня без правок кода отвечает из кэша (`cache hit, replaying logs`, за миллисекунды) и в базу не заходит. Для честного прогона добавьте `--force`: `npm run test:e2e -- --force`, либо запустите скрипт напрямую: `npm run test:e2e -w api`.
- **Prisma-клиент.** Прямой запуск скрипта (`-w api`) не выполняет `db:generate`: после правки `prisma/schema.prisma` сначала `npm run db:generate -w api`. Из корня через Turborepo клиент пересоберётся сам.

Если e2e-тесты падают:

- `Не задана переменная окружения DATABASE_URL`: нет корневого `.env`.
- `PrismaClientKnownRequestError: Invalid … invocation` без объяснения причины: база не запущена, выполните `docker compose up -d --wait`.
- То же и строка ``The table `public.users` does not exist``: не применены миграции, выполните `npm run db:deploy -w api`.

Полная проверка перед коммитом: `npx turbo run lint check-types test test:e2e build && npm run format:check`.

## Git-хук

Перед каждым коммитом срабатывает `pre-commit` ([Husky](https://typicode.github.io/husky/), файл `.husky/pre-commit`): он запускает `turbo run lint test test:e2e`, и если что-то красное, коммит отменяется. Хук подключается сам при `npm install`: скрипт `prepare` выставляет `core.hooksPath`.

- **Нужна база.** E2E-тесты ходят в PostgreSQL, поэтому перед коммитом кода должны быть запущены база и применены миграции (см. «Тесты»). Результат кэшируется Turborepo: коммит без правок кода отвечает из кэша за доли секунды и в базу не заходит.
- **Проверяется рабочая копия**, а не индекс: правки, которые вы не добавили в коммит, тоже участвуют в проверке. `check-types`, `build` и `format:check` хук не запускает: их покрывает «полная проверка» из раздела «Тесты».
- **Запустить вручную**, не делая коммит: `git hook run pre-commit` (нужен git 2.36 или новее).
- **Пропустить**: `git commit --no-verify` для одного коммита или `HUSKY=0 git commit …`. Красный хук лучше чинить, а не обходить.
- **Окружение.** Хук берёт ту версию Node, что активна в месте коммита (`nvm use`). Если коммит делается из среды без nvm (GUI-клиент, IDE) и хук не находит `node` или `npm`, подключите nvm в `~/.config/husky/init.sh`.

## Структура

```text
apps/
  web/      Next.js
  api/      NestJS
packages/   общие пакеты (подключены в workspaces, пока пусто)
.husky/     git-хук pre-commit
docker-compose.yml   локальный PostgreSQL
```

## Соглашения

- **Prettier.** Один конфиг (`.prettierrc`) и одна версия на весь репозиторий, запускается из корня.
- **ESLint.** Свой flat-конфиг в каждом приложении (`eslint.config.mjs`) плюс `eslint-config-prettier`, чтобы правила ESLint не конфликтовали с Prettier. В `web` стоит ESLint 9, потому что `eslint-config-next` пока не поддерживает 10. В `api` стоит ESLint 10.
- **Зависимости.** npm не запускает install-скрипты пакетов, пока они не перечислены в `allowScripts` корневого `package.json`.
- **Переменные окружения.** Turborepo работает в strict-режиме: задачи видят только те переменные из shell, что перечислены в `turbo.json` (`env` / `globalEnv`). Например, `PORT=5000 npm run dev` порт не изменит. `.env`-файлы приложения читают сами, это ограничение их не касается: `api` берёт корневой `.env`, а `web` (Next.js) читает `.env*` только из `apps/web`.
- **web → api.** Браузер в `api` напрямую не ходит: `web` вызывает его с сервера (Server Actions и Server Components) по REST. Адрес задаёт серверная переменная `API_URL` (по умолчанию `http://localhost:4000`), JWT лежит в httpOnly-cookie `access_token`. Поэтому CORS в `api` не включён. Подробности — в `apps/web/CLAUDE.md`.
- **CQRS в api.** Контроллеры только отправляют команду или запрос в шину `@nestjs/cqrs`, логика живёт в обработчиках. Данные другого модуля тоже берут через шину: так `auth` работает с `users`. Подробные правила — в `apps/api/CLAUDE.md`.
