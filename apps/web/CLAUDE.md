# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## apps/web

Фронтенд на Next.js 16.4 (App Router), React 19.3, Tailwind CSS 4 и TypeScript 5.9. Turbopack используется и в `dev`, и в `build`. Код лежит в `src/app`, алиас `@/*` указывает на `./src/*`. Порт 3000.

## Команды

Запускать как `pnpm --filter web <script>` из корня или через turbo: `pnpm <task> --filter=web`.

- `dev`, `build`, `start` — стандартные команды `next`.
- `lint` / `lint:fix` — ESLint CLI. Команды `next lint` в Next 16 нет.
- `check-types` — `next typegen && tsc --noEmit`. `typegen` генерирует типы роутов в `.next/types` и `next-env.d.ts`, оба файла не коммитятся.
- Тестового раннера пока нет.

## Что учитывать в коде

- В `next.config.ts` включены `cacheComponents` и `partialPrefetching`. Данные по умолчанию динамические, кэширование включается явно через `'use cache'` вместе с `cacheLife` и `cacheTag`. Обращение к некэшированным данным (`fetch`, `cookies()`, `connection()` и т. п.) вне `<Suspense>` ломает пререндер роута. Варианты исправления Next показывает в dev overlay и в выводе `next build`. Edge runtime не поддерживается.
- При клиентской навигации роут не размонтируется, а скрывается через React `<Activity>`. State сохраняется, эффекты очищаются и создаются заново, когда роут снова становится видимым. Камеру, микрофон и WebRTC-соединения держи в эффектах с cleanup. Подробнее: `node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`.
- Tailwind 4 подключён Turbopack-лоадером `@tailwindcss/turbopack` (`turbopack.rules` в `next.config.ts`), PostCSS-конфига нет. Стили лежат в `src/app/globals.css`.
- ESLint закреплён на 9.x: плагины из `eslint-config-next` 16.4 (react, jsx-a11y, import) не поддерживают ESLint 10. Поднимать версию только вместе с `eslint-config-next`.

## HeroUI

В корне репозитория установлен agent skill для HeroUI v3: `.agents/skills/heroui-react/SKILL.md`, источник указан в `skills-lock.json`. Сам `@heroui/react` в web пока не установлен. Перед работой с HeroUI прочитай SKILL.md: API v3 несовместим с v2. Шаги установки в skill рассчитаны на npm и PostCSS. Здесь пакеты ставятся через `pnpm --filter web add …`, а Tailwind подключён через `@tailwindcss/turbopack`, а не PostCSS.
