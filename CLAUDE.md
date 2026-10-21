# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Обзор

Монорепозиторий сервиса видеовстреч на pnpm workspaces и Turborepo. Два независимых приложения, общего кода пока нет:

- `apps/web` — фронтенд на Next.js, порт 3000 (см. `apps/web/CLAUDE.md`)
- `apps/api` — бэкенд на NestJS, порт 4000 (см. `apps/api/CLAUDE.md`)
- `packages/*` — место под общие пакеты. Glob объявлен в `pnpm-workspace.yaml`, каталога пока нет.

Версии инструментов новее данных обучения, поэтому сверяйся с документацией установленных пакетов, а не с памятью: Next.js 16.4, NestJS 12, Turborepo 2.11, pnpm 12, Vitest 4, ESLint 9 и 10, TypeScript 5.9 и 6.0.

## Окружение

- Нужен Node ≥ 24.15 (`.nvmrc`). Если `pnpm` не найден или Nest CLI падает с `ERR_REQUIRE_CYCLE_MODULE`, активна старая версия Node: `source ~/.nvm/nvm.sh && nvm use`.
- Пакетный менеджер только pnpm, версия закреплена в `packageManager`. Команды вида `npm i …` из инструкций библиотек переводи в `pnpm --filter <web|api> add …`. Общие dev-инструменты ставятся в корень: `pnpm add -Dw …`.

## База данных

PostgreSQL 18 в Docker: `docker-compose.yml` в корне, не turbo-задача. Запуск: `docker compose up -d --wait`, остановка: `docker compose down` (`-v` удаляет том с данными). Параметры (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`) читаются из корневого `.env`, значения по умолчанию и шаблон в `.env.example`. `api` к базе пока не подключён.

## Команды

Запускаются из корня. turbo выполняет задачу во всех приложениях и кэширует результат.

```bash
pnpm dev           # оба приложения в watch-режиме
pnpm build         # production-сборка
pnpm start         # build + запуск production-версий
pnpm lint          # ESLint; lint:fix — с автоисправлением
pnpm check-types   # проверка типов TypeScript
pnpm test          # unit-тесты (пока есть только в api)
pnpm test:e2e      # e2e-тесты api
pnpm format        # Prettier --write по всему репозиторию; format:check — проверка
```

- Одно приложение: `pnpm <task> --filter=web` (через turbo) или `pnpm --filter api <script> [args]` (скрипт напрямую, без turbo).
- Полная проверка: `pnpm turbo run lint check-types test test:e2e build && pnpm format:check`.

## Устройство монорепозитория

- **Turborepo** запускает только задачи, объявленные в `tasks` в `turbo.json`. Новый скрипт, который должен работать через turbo, сначала объяви там, иначе turbo выдаст `Could not find task`. `format` и `format:check` — обычные корневые скрипты, а не turbo-задачи.
- **Переменные окружения.** turbo работает в strict-режиме: задачи не видят переменные shell, пока их не перечислят в `turbo.json` (`env`, `globalEnv`, `passThroughEnv`). Поэтому `PORT=5000 pnpm dev` порт не поменяет. `.env`-файлы приложения читают сами.
- **Prettier.** Один `.prettierrc` в корне (`singleQuote`, `trailingComma: all`), точная версия в корневом `package.json`. Конфиги Prettier в приложения не добавлять. Prettier пропускает пути из корневого `.gitignore` и `.prettierignore`. Файлы, изменённые через Edit/Write, автоматически форматирует хук Claude Code (`.claude/hooks/format.mjs`). Изменения через Bash, например вывод `nest g`, хук не видит: после них нужен `pnpm format`.
- **ESLint.** У каждого приложения свой flat-конфиг (`eslint.config.mjs`), `eslint-config-prettier` подключён в нём последним. `eslint-plugin-prettier` не используется. Версии ESLint в web и api разные намеренно, причины описаны в их CLAUDE.md.
- **TypeScript** не поднимать до 7.x: `typescript-eslint` 8.x поддерживает только версии `<6.1`.
- **pnpm 12.** Install-скрипты зависимостей заблокированы, пока пакет не указан в `allowBuilds` (`pnpm-workspace.yaml`). Без этого `pnpm install` падает. Неизвестный ключ в `pnpm-workspace.yaml` тоже роняет команды. Версии моложе суток pnpm не устанавливает.
- **AGENTS.md** в корне и в `apps/web` содержат управляемые блоки. Текст между маркерами `BEGIN` и `END` перезаписывают `turbo` и `next dev`, его не редактировать.

## Актуальность документации

Документация проекта — это `README.md`, этот файл и `apps/*/CLAUDE.md`. Если изменение затрагивает архитектуру, обнови документацию в той же задаче. К архитектуре относятся:

- состав workspace: новые приложения и пакеты в `packages/*`, зависимости между ними;
- скрипты в `package.json` и задачи в `turbo.json`;
- добавление или замена фреймворков, UI-библиотек, линтеров и тест-раннеров, а также обновление версий, указанных в документации;
- порты, переменные окружения и способ взаимодействия web и api (REST, WebSocket, сигналинг WebRTC и т. п.);
- соглашения, описанные в этих файлах.

Общее для репозитория описывай в корневых `README.md` и `CLAUDE.md`, специфику приложения — в его `CLAUDE.md`. Устаревшие сведения исправляй или удаляй, а не дописывай новые рядом.
