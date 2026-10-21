# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## apps/api

Бэкенд на NestJS 12 (платформа Express) и TypeScript 6.0. Пакет в формате ESM: `"type": "module"`, `module: nodenext`. Порт 4000 задаётся как `process.env.PORT ?? 4000` в `src/main.ts`. При запуске через turbo `PORT` из shell не пробрасывается.

## Команды

Запускать как `pnpm --filter api <script>` из корня или через turbo: `pnpm <task> --filter=api`.

- `dev` — `nest start --watch`; `start:debug` — то же с inspector; `start` — `node dist/main`, перед ним нужен `build`.
- `build` — `nest build` по `tsconfig.build.json`. Собирает только `src/` без спеков, результат в `dist/main.js`.
- `test` — unit-тесты на Vitest 4 (`src/**/*.spec.ts`). Один файл: `pnpm --filter api test src/app.controller.spec.ts`. По имени теста: `pnpm --filter api test -t "Hello World"`. Также есть `test:watch` и `test:cov`.
- `test:e2e` — e2e-тесты (`test/**/*.e2e-spec.ts`, конфиг `vitest.config.e2e.ts`). Один файл передаётся так же, путём.
- Генерация кода: `pnpm --filter api exec nest g <schematic> <name>` (module, controller, service и т. д.). Генератор пишет ESM-код со спеками под Vitest и регистрирует модуль в `AppModule`, но вывод не отформатирован. После генерации нужен `pnpm format`.

## ESM

- Относительные импорты пишутся с расширением `.js`, даже из `.ts`-файлов: `import { AppService } from './app.service.js'`.
- Подпути пакетов без поля `exports` тоже требуют расширения, иначе TypeScript их не найдёт: `import type { App } from 'supertest/types.js'`.
- В `src/main.ts` используется top-level `await`.

## Тесты и линтинг

- Vitest работает с `globals: true`: `describe`, `it`, `expect` и `vi` доступны без импорта. Типы подключены через `types` в `tsconfig.json`.
- Алиасы из `paths` в `tsconfig.json` Vitest резолвит сам (`resolve.tsconfigPaths: true` в обоих конфигах). Плагин `vite-tsconfig-paths` не нужен.
- ESLint 10 с `typescript-eslint` `recommendedTypeChecked`. Линтинг type-aware (`projectService`), поэтому файл вне `tsconfig.json` ESLint не разберёт. Шаблон Nest 12 по умолчанию ставит Oxlint, здесь вместо него осознанно выбран ESLint.
