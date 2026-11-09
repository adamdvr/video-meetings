# video-meetings

Монорепозиторий на [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces) и [Turborepo](https://turborepo.com).

| Приложение | Путь       | Стек                                                                               | Порт |
| ---------- | ---------- | ---------------------------------------------------------------------------------- | ---- |
| `web`      | `apps/web` | Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4, HeroUI 3, Playwright | 3000 |
| `api`      | `apps/api` | NestJS 12 (ESM), Prisma 7, Vitest                                                  | 4000 |

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

`api` принимает только форматы из PRD (MP4, WebM, MOV, MP3, M4A, WAV, OGG, PDF, DOCX, PPTX, XLSX, TXT, PNG, JPG, WebP, GIF), непустые и не больше 1 ГБ (1 ГиБ). Формат проверяется по расширению и по первым байтам файла. Пустой файл получает ответ 400, файл больше 1 ГБ — 413 ещё до чтения тела, недопустимый формат — 415. Отклонённая или оборванная загрузка не оставляет ни записи, ни файла в `.tmp/`. Остатки в `.tmp/` возможны, только если процесс `api` упал посреди загрузки; при старте они не удаляются, поэтому их убирают вручную при остановленном `api`: `rm -f apps/api/storage/.tmp/*.part`.

В `web` файлы встречи показаны в блоке «Файлы» на её странице. Загружают их там же: кнопкой «Выбрать файлы» или перетаскиванием в область загрузки, каждый файл отдельным запросом с прогрессом в процентах. Пустой файл, файл больше 1 ГБ и файл недопустимого формата `web` отклоняет ещё до отправки и показывает причину; остальные отказы `api` и обрыв связи тоже показаны у файла. Загрузку можно отменить, а оборванную или отменённую — повторить. Браузер отправляет файл на `POST /meetings/<id встречи>/files` в `web`, а Route Handler подставляет токен из cookie и передаёт тело в `api` потоком. Кнопка «Скачать» — обычная ссылка на `/meetings/<id встречи>/files/<id файла>` в `web`: Route Handler так же передаёт файл из `api` потоком, не держа его в памяти. Замер на production-сборке: при загрузке и скачивании файла в 1 ГиБ память `web` растёт на 35–115 МБ.

- **Загрузка дольше 5 минут обрывается.** Node.js закрывает запрос, тело которого принимается дольше `requestTimeout` (300 секунд), а `next start` этот таймаут не меняет. 1 ГБ за 5 минут успевает уйти на канале от ~30 Мбит/с, на более медленном у файла будет ошибка, и неполный файл в список не попадёт. Подробности и варианты — в `docs/research-meeting-upload.md`, раздел 7.

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
| `npm run test:e2e`                | e2e-тесты api и web                |
| `npm run format` / `format:check` | Prettier по всему репозиторию      |

Задача только для одного приложения: `npm run dev -- --filter=web`.
Скрипт приложения напрямую, без Turborepo: `npm run test:watch -w api`.

## Тесты

В `api` — unit- и e2e-тесты на Vitest 4, в `web` — e2e-тесты на Playwright Test.

- **Unit** (`apps/api/src/**/*.spec.ts`): `npm test`. Пока он один (`src/config/configuration.spec.ts`), основное поведение покрывают e2e-тесты.
- **E2E api** (`apps/api/test/*.e2e-spec.ts`): `npm run test:e2e`. Поднимают приложение целиком, обращаются к нему по HTTP и через шину CQRS, пишут данные в настоящий PostgreSQL, а загруженные файлы — в каталог хранения.

- **E2E web** (`apps/web/e2e/*.spec.ts`): тот же `npm run test:e2e`. Открывают страницы в Chromium и проходят сценарии пользователя: данные готовят через REST api, вход — подстановкой cookie с токеном. Playwright переиспользует запущенные dev-серверы web (3000) и api (4000), а если их нет — сам запускает `npm run dev` обоих приложений и останавливает после прогона. Браузер скачивается один раз: `npm exec -w web -- playwright install chromium`. Отчёт о прогоне — `apps/web/playwright-report` (`npx playwright show-report` из `apps/web`), трассы упавших тестов — `apps/web/test-results`; обе папки в `.gitignore`.

Для e2e нужно то же окружение, что и для `npm run dev`: `nvm use`, корневой `.env` (`cp .env.example .env`, нужны `DATABASE_URL` и `JWT_SECRET`), запущенная база (`docker compose up -d --wait`) и применённые миграции (`npm run db:deploy -w api`).

```bash
npm run test:e2e -w api -- test/auth.e2e-spec.ts           # один файл
npm run test:e2e -w api -- -t "возвращает 409"             # по имени теста
npm run test:e2e -w api -- test/auth.e2e-spec.ts -t "409"  # файл и имя вместе
npm run test:e2e -w web                                     # только web
npm run test:e2e -w web -- --ui                             # web в окне Playwright UI
```

Что нужно знать:

- **Одна база на всё.** E2E-тесты работают с той же базой, что и `npm run dev`, и ничего не удаляют. Тесты, которые что-то создают, берут уникальные данные (`user-<uuid>@example.com`), поэтому не мешают друг другу и вашим данным, но тестовые пользователи и их файлы накапливаются (см. «Файлы встреч»).
- **Кэш Turborepo.** `test` и `test:e2e` кэшируются по файлам проекта, а не по состоянию базы. Повторный запуск из корня без правок кода отвечает из кэша (`cache hit, replaying logs`, за миллисекунды) и в базу не заходит. Для честного прогона добавьте `--force`: `npm run test:e2e -- --force`, либо запустите скрипт напрямую: `npm run test:e2e -w api`.
- **web после api.** Через Turborepo e2e-тесты web запускаются только после e2e-тестов api (`turbo.json`). Задача `db:generate` перезаписывает Prisma-клиент, запущенный `npm run dev` перезапускает api, и web-тесты, начатые параллельно, падали с `ECONNREFUSED :4000`. Поэтому `npm run test:e2e -- --filter=web` прогоняет и api; только web — `npm run test:e2e -w web`.
- **Prisma-клиент.** Прямой запуск скрипта (`-w api`) не выполняет `db:generate`: после правки `prisma/schema.prisma` сначала `npm run db:generate -w api`. Из корня через Turborepo клиент пересоберётся сам.

Если e2e-тесты падают:

- `Не задана переменная окружения DATABASE_URL`: нет корневого `.env`.
- `PrismaClientKnownRequestError: Invalid … invocation` без объяснения причины: база не запущена, выполните `docker compose up -d --wait`.
- То же и строка ``The table `public.users` does not exist``: не применены миграции, выполните `npm run db:deploy -w api`.
- `browserType.launch: Executable doesn't exist` в web: не скачан Chromium, выполните `npm exec -w web -- playwright install chromium`.
- `ECONNREFUSED ::1:4000` в web: api не запущен или перезапустился во время прогона.

Полная проверка перед коммитом: `npx turbo run lint check-types test test:e2e build && npm run format:check`.

## Git-хук

Перед каждым коммитом срабатывает `pre-commit` ([Husky](https://typicode.github.io/husky/), файл `.husky/pre-commit`): он запускает `turbo run lint test test:e2e`, и если что-то красное, коммит отменяется. Хук подключается сам при `npm install`: скрипт `prepare` выставляет `core.hooksPath`.

- **Нужна база.** E2E-тесты ходят в PostgreSQL, поэтому перед коммитом кода должны быть запущены база и применены миграции (см. «Тесты»). E2E-тесты web вдобавок используют dev-серверы: если `npm run dev` не запущен, хук поднимет их сам, и коммит займёт дольше. Результат кэшируется Turborepo: коммит без правок кода отвечает из кэша за доли секунды и в базу не заходит.
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
- **web → api.** Браузер в `api` напрямую не ходит: `web` вызывает его с сервера (Server Actions, Server Components и Route Handlers) по REST. Байты файлов идут через Route Handlers потоком, мимо Server Actions и `proxy`. Адрес задаёт серверная переменная `API_URL` (по умолчанию `http://localhost:4000`), JWT лежит в httpOnly-cookie `access_token`. Поэтому CORS в `api` не включён. Подробности — в `apps/web/CLAUDE.md`.
- **CQRS в api.** Контроллеры только отправляют команду или запрос в шину `@nestjs/cqrs`, логика живёт в обработчиках. Данные другого модуля тоже берут через шину: так `auth` работает с `users`. Подробные правила — в `apps/api/CLAUDE.md`.
