# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Обзор

Монорепозиторий сервиса видеовстреч на npm workspaces и Turborepo. Два независимых приложения, общего кода пока нет:

- `apps/web` — фронтенд на Next.js, порт 3000 (см. `apps/web/CLAUDE.md`)
- `apps/api` — бэкенд на NestJS, порт 4000 (см. `apps/api/CLAUDE.md`)
- `packages/*` — место под общие пакеты. Glob объявлен в `workspaces` корневого `package.json`, каталога пока нет.

Версии инструментов новее данных обучения, поэтому сверяйся с документацией установленных пакетов, а не с памятью: Next.js 16.4, NestJS 12, Turborepo 2.11, npm 11, Vitest 4, ESLint 9 и 10, TypeScript 5.9 и 6.0.

## Окружение

- Нужен Node ≥ 24.15 (`.nvmrc`). Если Nest CLI падает с `ERR_REQUIRE_CYCLE_MODULE`, активна старая версия Node: `source ~/.nvm/nvm.sh && nvm use`.
- Пакетный менеджер только npm, версия закреплена в `packageManager`. Зависимости приложения ставь с флагом workspace: `npm install <пакет> -w <web|api>`. Общие dev-инструменты ставятся в корень: `npm install -D <пакет>`. Lockfile один, `package-lock.json` в корне.

## База данных

PostgreSQL 18 в Docker: `docker-compose.yml` в корне, не turbo-задача. Запуск: `docker compose up -d --wait`, остановка: `docker compose down` (`-v` удаляет том с данными). Параметры (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`) читаются из корневого `.env`, значения по умолчанию и шаблон в `.env.example`. `api` подключается к ней через Prisma (`DATABASE_URL` в том же `.env`), подробности в `apps/api/CLAUDE.md`.

## Команды

Запускаются из корня. turbo выполняет задачу во всех приложениях и кэширует результат.

```bash
npm run dev        # оба приложения в watch-режиме
npm run build      # production-сборка
npm start          # build + запуск production-версий
npm run lint       # ESLint; lint:fix — с автоисправлением
npm run check-types # проверка типов TypeScript
npm test            # unit-тесты (пока есть только в api)
npm run test:e2e  # e2e-тесты api
npm run format     # Prettier --write по всему репозиторию; format:check — проверка
```

- Одно приложение: `npm run <task> -- --filter=web` (через turbo) или `npm run <script> -w api [-- args]` (скрипт напрямую, без turbo).
- Полная проверка: `npx turbo run lint check-types test test:e2e build && npm run format:check`.

## Устройство монорепозитория

- **Turborepo** запускает только задачи, объявленные в `tasks` в `turbo.json`. Задача `db:generate` (генерация Prisma-клиента в `apps/api/src/generated`) выполняется перед `build`, `lint`, `check-types`, `test` и `test:e2e`. Новый скрипт, который должен работать через turbo, сначала объяви там, иначе turbo выдаст `Could not find task`. `format` и `format:check` — обычные корневые скрипты, а не turbo-задачи.
- **Переменные окружения.** turbo работает в strict-режиме: задачи не видят переменные shell, пока их не перечислят в `turbo.json` (`env`, `globalEnv`, `passThroughEnv`). Сейчас так проброшены `API_URL`, `DATABASE_URL`, `JWT_SECRET` и `JWT_EXPIRES_IN_SECONDS` (`globalPassThroughEnv`). Поэтому `PORT=5000 npm run dev` порт не поменяет. `.env`-файлы приложения читают сами: api берёт корневой `.env`, web (Next.js) — только `.env*` из `apps/web`.
- **web → api.** Браузер в api напрямую не ходит: web обращается к нему с сервера (Server Actions и т. п.) по REST. Адрес задаёт серверная переменная `API_URL` (по умолчанию `http://localhost:4000`), JWT web хранит в httpOnly-cookie `access_token`. CORS в api поэтому не включён. Подробности — в `apps/web/CLAUDE.md`.
- **Prettier.** Один `.prettierrc` в корне (`singleQuote`, `trailingComma: all`), точная версия в корневом `package.json`. Конфиги Prettier в приложения не добавлять. Prettier пропускает пути из корневого `.gitignore` и `.prettierignore`. Файлы, изменённые через Edit/Write, автоматически форматирует хук Claude Code (`.claude/hooks/format.mjs`). Изменения через Bash, например вывод `nest g`, хук не видит: после них нужен `npm run format`.
- **ESLint.** У каждого приложения свой flat-конфиг (`eslint.config.mjs`), `eslint-config-prettier` подключён в нём последним. `eslint-plugin-prettier` не используется. Версии ESLint в web и api разные намеренно, причины описаны в их CLAUDE.md.
- **TypeScript** не поднимать до 7.x: `typescript-eslint` 8.x поддерживает только версии `<6.1`.
- **npm 11.** Install-скрипты зависимостей разрешаются через `allowScripts` в корневом `package.json`. Для Prisma разрешены `prisma` и `@prisma/engines`, `unrs-resolver` и `fsevents` запрещены. Новый пакет со скриптом установки npm предупредит сам: решение фиксируй командой `npm install-scripts approve|deny <пакет> --no-allow-scripts-pin`.
- **Переопределение `multer`.** В `overrides` корневого `package.json` закреплён `multer@2.5.0`: `@nestjs/platform-express` 12.2.0 требует уязвимый `2.4.0` (DoS, GHSA-q7qp-rjg7-q26m). Когда выйдет `@nestjs/platform-express` с исправленным multer, убери override.
- **AGENTS.md** в корне и в `apps/web` содержат управляемые блоки. Текст между маркерами `BEGIN` и `END` перезаписывают `turbo` и `next dev`, его не редактировать.
- **Agent skills** лежат в `.agents/skills/`, их ставит skills CLI, источники и хэши записаны в `skills-lock.json`. Claude Code ищет skills только в `.claude/skills/`, поэтому там лежат относительные симлинки на них. Для нового skill добавь ссылку: `ln -s ../../.agents/skills/<name> .claude/skills/<name>`. Файлы skills не редактировать: обновление через skills CLI их перезапишет.

## Актуальность документации

Документация проекта — это `README.md`, этот файл и `apps/*/CLAUDE.md`. Если изменение затрагивает архитектуру, обнови документацию в той же задаче. К архитектуре относятся:

- состав workspace: новые приложения и пакеты в `packages/*`, зависимости между ними;
- скрипты в `package.json` и задачи в `turbo.json`;
- добавление или замена фреймворков, UI-библиотек, линтеров и тест-раннеров, а также обновление версий, указанных в документации;
- порты, переменные окружения и способ взаимодействия web и api (REST, WebSocket, сигналинг WebRTC и т. п.);
- соглашения, описанные в этих файлах.

Общее для репозитория описывай в корневых `README.md` и `CLAUDE.md`, специфику приложения — в его `CLAUDE.md`. Устаревшие сведения исправляй или удаляй, а не дописывай новые рядом.
