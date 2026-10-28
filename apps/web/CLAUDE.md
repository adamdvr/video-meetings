# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## apps/web

Фронтенд на Next.js 16.4 (App Router), React 19.3, Tailwind CSS 4 и TypeScript 5.9. Turbopack используется и в `dev`, и в `build`. Код лежит в `src/app` (роуты), `src/components` (общие компоненты), `src/lib` (серверные хелперы: обращение к api, сессия) и `src/proxy.ts` (редирект до рендера), алиас `@/*` указывает на `./src/*`. Порт 3000.

## Команды

Запускать как `npm run <script> -w web` из корня или через turbo: `npm run <task> -- --filter=web`.

- `dev`, `build`, `start` — стандартные команды `next`.
- `lint` / `lint:fix` — ESLint CLI. Команды `next lint` в Next 16 нет.
- `check-types` — `next typegen && tsc --noEmit`. `typegen` генерирует типы роутов в `.next/types` и `next-env.d.ts`, оба файла не коммитятся.
- Тестового раннера пока нет.

## Что учитывать в коде

- В `next.config.ts` включены `cacheComponents` и `partialPrefetching`. Данные по умолчанию динамические, кэширование включается явно через `'use cache'` вместе с `cacheLife` и `cacheTag`. Обращение к некэшированным данным (`fetch`, `cookies()`, `connection()` и т. п.) вне `<Suspense>` ломает пререндер роута. Варианты исправления Next показывает в dev overlay и в выводе `next build`. Edge runtime не поддерживается.
- При клиентской навигации роут не размонтируется, а скрывается через React `<Activity>`. State сохраняется, эффекты очищаются и создаются заново, когда роут снова становится видимым. Камеру, микрофон и WebRTC-соединения держи в эффектах с cleanup. Подробнее: `node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`.
- Tailwind 4 подключён Turbopack-лоадером `@tailwindcss/turbopack` (`turbopack.rules` в `next.config.ts`), PostCSS-конфига нет. Стили лежат в `src/app/globals.css`. Запущенный `next dev` не подхватывает правки самого `globals.css` (`@theme`, `@utility`, свои правила), хотя новые классы Tailwind из `.tsx` подхватывает: после правки перезапусти его.
- ESLint закреплён на 9.x: плагины из `eslint-config-next` 16.4 (react, jsx-a11y, import) не поддерживают ESLint 10. Поднимать версию только вместе с `eslint-config-next`.
- Заголовок страницы задаётся как `title: 'Название'`: шаблон `%s — Video meetings` лежит в метаданных корневого `layout.tsx`, а главная использует `default`.
- `layout.tsx` ставит `suppressHydrationWarning` на `<html>` и `<body>`: расширения браузера дописывают им атрибуты до гидрации (например, `trancy-version`), и без этого dev overlay показывал «1 Issue» с ошибкой hydration на каждой странице. Атрибут действует только на сам элемент, на вложенные не влияет.
- Dev-сервер открывай по `localhost`. Для `127.0.0.1` и любого IP Next блокирует HMR-сокет (в `.next/dev/logs/next-development.log` строка `Blocked cross-origin request to Next.js dev resource /_next/hmr`), и страница не гидрируется: «глаз» не нажимается, форма уходит обычным POST и возвращается с красными полями. Другой хост разрешает `allowedDevOrigins` в `next.config.ts`.

## Обращение к api и авторизация

Браузер в api напрямую не ходит: запросы идут с сервера web (Server Actions, Server Components, Route Handlers), поэтому CORS в api не включён.

- `src/lib/api.ts`: `apiFetch(path, init)` — `fetch` к api с таймаутом 10 с. Адрес api берётся из серверной переменной `API_URL`, по умолчанию `http://localhost:4000`. Next читает `.env*` из `apps/web`, а не из корня репозитория: задавай её в `apps/web/.env.local` или в окружении (через turbo она проброшена в `globalPassThroughEnv`).
- `src/lib/session.ts`: `createSession(accessToken)` кладёт JWT из api в cookie `access_token` (httpOnly, `SameSite=Lax`, `Secure` в production, срок жизни берётся из `exp` токена), `deleteSession()` удаляет её, `getSession()` возвращает `{ email }` или `null`. Для защищённых роутов api читай cookie через `cookies()` и передавай её значение как `Authorization: Bearer <jwt>`. Разбор токена лежит в `src/lib/access-token.ts` без `next/headers`, чтобы им пользовался и proxy.
- `getSession()` и proxy проверяют сессию оптимистично, только по cookie: токен должен разбираться, содержать `email` и не быть просроченным. Подпись web не проверяет (секрет JWT нужен только api), это делает api на каждый запрос, поэтому для доступа к данным эти проверки не годятся: они лишь выбирают, что показать. Если cookie осталась от удалённого пользователя (например, после `docker compose down -v`), интерфейс считает его вошедшим, пока он не нажмёт «Выйти» на главной. `getSession()` вызывает `connection()` перед проверкой срока: при `partialPrefetching` код после `cookies()` выполняется ещё при пререндере оболочки, где `Date.now()` запрещён, и без этого в dev на главной с сессией падала ошибка `unstable value Date.now()`.
- `src/proxy.ts` (в Next 16 это бывший middleware): GET `/register` с сессионной cookie редиректит на `/` до рендера. Server Action формы приходит на тот же путь POST-запросом, поэтому proxy пропускает всё, кроме GET. Значение `matcher` должно оставаться константой.
- Главная `/`: блок с кнопками входа и выхода читает сессию из cookie на каждый запрос, поэтому лежит в `<Suspense>` (при `cacheComponents` чтение cookie вне него ломает сборку) и стримится вне статической оболочки. Выход — Server Action `logout` из `src/app/actions.ts`: удаляет cookie и делает `redirect('/')`.
- Регистрация, `/register` (`src/app/register`): клиентская форма `register-form.tsx` вызывает Server Action `register` из `actions.ts`. Тот проверяет поля, шлёт `POST /auth/register`, ставит cookie и делает `redirect('/')`. Ответ 409 превращается в ошибку под полем email, 400 — в ошибки полей, недоступность api или таймаут — в общий `Alert`. Правила в `validation.ts` повторяют `RegisterDto` в api: меняя одни, правь и другие.
- Отправка формы: `<Form action={formAction} onSubmit={handleSubmit}>`. В браузере с JS срабатывает `onSubmit`: он делает `preventDefault()` и вызывает `startTransition(() => formAction(formData))`. После `preventDefault()` React `action` не запускает и поля не сбрасывает, поэтому введённое не пропадает при каждой ошибке сервера. `action` нужен на случай отправки до гидрации или без JS: форма уходит обычным POST (Next добавляет скрытые поля `$ACTION_*`), регистрация работает целиком, а пароль не попадает в URL. Без `action` и `method` браузер отправил бы GET, и пароль оказался бы в адресе `/register?email=…&password=…`.
- Ошибки полей живут в состоянии формы (`errors`), а не в `validate` и `validationErrors` HeroUI, у `Form` стоит `validationBehavior="aria"`. Причина: встроенная валидация обновляет ошибку только при уходе с поля, и исправленное поле оставалось красным. Ошибка появляется при уходе с поля, в которое что-то вводили, или при отправке; пока она показана, пересчитывается на каждый ввод и пропадает, как только значение стало верным, а новая ошибка при наборе не мигает. Ответ сервера заменяет ошибки на экране, первая правка поля снимает серверную ошибку. `Alert` общей ошибки пересоздаётся на каждый ответ (`key`), чтобы скринридер озвучил и повторную ошибку.
- Кнопки формы («глаз» у пароля и отправка) нажимаются с `preventFocusOnPress`: нажатие мышью не уводит фокус из поля. Иначе blur показывает ошибку под email, блок с тем, что ниже, сдвигается на ~20 px, кнопка уходит из-под курсора, и браузер не доставляет ей `click`. В этой версии React Aria `onPress` срабатывает именно из `click`, поэтому «глаз» не переключал пароль, а клик по верхней половине «Создать аккаунт» пропадал. Новую кнопку внутри формы с проверкой на blur заводи так же. С клавиатуры кнопки работают как обычно.
- Если Server Action завершается `redirect()`, Next отклоняет его промис на клиенте и перемонтирует поддерево. Поэтому форма, скрытая через `<Activity>`, не хранит ни пароль, ни старые ошибки, и сбрасывать её вручную не нужно.

## HeroUI

HeroUI v3 (`@heroui/react`, `@heroui/styles`) установлен в web. Стили подключены в `src/app/globals.css` строкой `@import '@heroui/styles'` сразу после `@import 'tailwindcss'`. Provider не нужен. Перед работой с HeroUI используй skill `heroui-react`: API v3 несовместим с v2, компоненты составные (`Card.Header`), обработчик называется `onPress`. Шаги установки в skill рассчитаны на PostCSS, а здесь Tailwind подключён через `@tailwindcss/turbopack`, поэтому `postcss.config.mjs` не нужен. HeroUI задаёт CSS-переменные `--background` и `--foreground`, не переопределяй их в `globals.css`. После установки новых пакетов перезапусти `next dev`, иначе стили не подхватятся.

- Составные компоненты (`Card.Header`, `Alert.Title`) работают и в Server Components.
- Иконки берутся из `@gravity-ui/icons`, как в документации HeroUI. Импортируй их по одной: `import Eye from '@gravity-ui/icons/Eye'`, а не из корня пакета. Корневой barrel не входит в `optimizePackageImports` Next и тянет в dev-бандл все ~800 иконок (замер: +1,5 МБ JS на странице). Иконки сами не скрываются от скринридера, декоративным добавляй `aria-hidden="true"`.
- Базовые стили HeroUI не задают `body` ни фон, ни цвет текста. Страница, которой нужна тема, ставит `bg-background text-foreground` сама (пример: `src/app/register/page.tsx`). Тёмная тема включается только классом `.dark` или `data-theme="dark"`, по `prefers-color-scheme` сама не включается.
- При уходе со страницы с формой и возврате на неё React Aria в dev-консоли пишет «If you do not provide a visible label…»: `<Activity>` отсоединяет ref подписей. Подписи после возврата на месте, в production этого предупреждения нет.
- Контраст. Цвета HeroUI по умолчанию не проходят WCAG AA (`--danger` и `--accent` дают 3,6:1, `--muted` 4,1–4,8:1), а у полей нет рамки. `globals.css` переопределяет `--accent`, `--danger`, `--muted`, `--field-border` и `--field-border-width` для светлой темы: селектор `:root:not(.dark, [data-theme='dark'])` не пускает значения в тёмную. Правило стоит вне слоя, а HeroUI объявляет переменные в `@layer base`, поэтому оно побеждает при любой специфичности. После правки токенов проверяй axe-core: `color-contrast` на `/register` не должен срабатывать ни в обычном состоянии, ни с ошибками.
- `InputGroup`: на `InputGroup.Input` ставь `min-w-0`. У `input` по умолчанию `min-width: auto` и `size=20` (≈197 px), поэтому группа «иконка, поле, кнопка» не сжимается и на экранах уже ~370 px кнопка вылезает за поле. Пока `--field-border-width` больше нуля, HeroUI рисует разделители у `InputGroup.Prefix` и `InputGroup.Suffix`: убирай их классом `border-0`. Звёздочку обязательного поля HeroUI рисует через `::after` на `Label`, и она попадает в имя поля («Email*»): если обязательны все поля, убирай её классом `after:content-none`.
