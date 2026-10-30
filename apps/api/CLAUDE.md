# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## apps/api

Бэкенд на NestJS 12 (платформа Express) и TypeScript 6.0. Пакет в формате ESM: `"type": "module"`, `module: nodenext`. Порт 4000 задаётся как `process.env.PORT ?? 4000` в `src/main.ts`. При запуске через turbo `PORT` из shell не пробрасывается.

## Команды

Запускать как `npm run <script> -w api` из корня или через turbo: `npm run <task> -- --filter=api`.

- `dev` — `nest start --watch`; `start:debug` — то же с inspector; `start` — `node dist/main`, перед ним нужен `build`.
- `build` — `nest build` по `tsconfig.build.json`. Собирает только `src/` без спеков, результат в `dist/main.js`.
- `test` — unit-тесты на Vitest 4 (`src/**/*.spec.ts`). Пока ни одного нет, поведение api проверяют e2e-тесты, а `passWithNoTests` в `vitest.config.ts` не даёт задаче упасть без файлов. Один файл: `npm run test -w api -- src/<путь>.spec.ts`. По имени теста: `npm run test -w api -- -t "<имя>"`. Также есть `test:watch` и `test:cov`.
- `test:e2e` — e2e-тесты (`test/**/*.e2e-spec.ts`, конфиг `vitest.config.e2e.ts`). Нужен запущенный PostgreSQL с применёнными миграциями (`docker compose up -d --wait`, `db:deploy`); тесты оставляют в базе пользователей `user-<uuid>@example.com`. Один файл передаётся так же, путём.
- Генерация кода: `npm exec -w api -- nest g <schematic> <name>` (module, controller, service и т. д.). Генератор пишет ESM-код со спеками под Vitest и регистрирует модуль в `AppModule`, но вывод не отформатирован. После генерации нужен `npm run format`.

## База данных и Prisma

- Prisma 7 с драйвер-адаптером `@prisma/adapter-pg`. Схема в `prisma/schema.prisma`, миграции в `prisma/migrations`, конфиг в `prisma.config.ts`. Версии `prisma` и `@prisma/client` закреплены точно: `latest` в npm сейчас 8.0 RC.
- Клиент генерируется в `src/generated/prisma` (в git не попадает, ESLint его пропускает). Генерация: `db:generate`; она же в `postinstall` и в turbo перед остальными задачами. После изменения схемы: `db:migrate` (dev, создаёт миграцию) и `db:deploy` (применяет существующие).
- `PrismaService` (глобальный `PrismaModule`) наследует `PrismaClient`.
- Конфигурация читается в `src/config/configuration.ts`: он при импорте подгружает корневой `.env` (`process.loadEnvFile`, переменные окружения приоритетнее), `getConfig()` требует `DATABASE_URL` и `JWT_SECRET`. Тесты и `nest start` берут их из `.env`, без него нужны переменные в окружении.

## Модули

`AppModule` (`src/app.module.ts`) только собирает приложение: импортирует модули ниже и подключает глобальный `ValidationPipe` через `APP_PIPE`. Своих контроллеров и сервисов у него нет, поэтому корневой `GET /` отвечает 404. Новый модуль добавляй в его `imports`.

- `PrismaModule` (`src/prisma`, глобальный): `PrismaService`, клиент БД. Импортировать его в другие модули не нужно.
- `AuthModule` (`src/auth`): эндпоинты `/auth/*`, пароли и JWT, `JwtAuthGuard` и `@CurrentUser()`; см. «Авторизация». `JwtModule` в нём зарегистрирован как глобальный, поэтому `JwtAuthGuard` работает в любом модуле без импорта `AuthModule`. Зависит от `UsersModule`.
- `UsersModule` (`src/users`): создание и поиск пользователей, только сообщения для других модулей; см. «Пользователи». От других прикладных модулей не зависит.
- `MeetingsModule` (`src/meetings`): встречи текущего пользователя, `/meetings`; см. «Встречи». Из `auth` берёт `JwtAuthGuard` и `@CurrentUser()` (импорт файлов, а не модуля).

Зависимости идут в одну сторону: `meetings` → `auth` → `users`. Данные другого модуля берут через шину, правила — в разделе «CQRS».

## CQRS

Бизнес-операции api построены на `@nestjs/cqrs` (модули `auth`, `users` и `meetings`). Контроллер не содержит логики: он принимает DTO, собирает сообщение и отправляет его в шину (`CommandBus` или `QueryBus`), а возвращает то, что вернул обработчик.

- **Команда** меняет состояние (создаёт, обновляет, удаляет), **запрос** только читает. Критерий именно этот, а не HTTP-метод: `POST /auth/login` ничего не пишет в базу, поэтому это `LoginQuery`.
- **Сообщение** — класс с `public readonly` параметрами конструктора, только примитивы и даты, без логики. Имена: `<Глагол><Сущность>Command` и `<Глагол><Сущность>Query`, файлы `commands/*.command.ts` и `queries/*.query.ts`.
- **Обработчик** (`@CommandHandler` или `@QueryHandler`, рядом с сообщением, файл `*.handler.ts`) — одна операция на один класс. Он работает с `PrismaService` и другими сервисами, бросает исключения Nest (`NotFoundException`, `ConflictException`, `UnauthorizedException`) и возвращает готовый ответ (для встреч это `MeetingView`, а не Prisma-модель). Запрос `Find…` (`FindUserByEmailQuery`) при отсутствии данных возвращает `null`, а не бросает `NotFoundException`: вызывающий модуль сам решает, что это значит (логин отвечает 401, а не 404).
- **Кто и над чем действует** передаётся в сообщении явно: например, `ownerId` в запросах встреч берётся из `@CurrentUser()` в контроллере. Обработчик не читает запрос HTTP.
- **Валидация формы** данных — в DTO контроллера (`class-validator`), правила предметной области — в обработчике.
- **Регистрация.** Модуль импортирует `CqrsModule`, а каждый обработчик попадает в `providers`. Без этого сообщение уйдёт в шину, и она бросит ошибку об отсутствующем обработчике.
- **Связь между модулями.** Модуль работает с чужими данными только через шину: его обработчик отправляет сообщение другого модуля и не лезет в чужие таблицы и сервисы (так `auth` общается с `users`). Контракт модуля — его сообщения и тип результата. Сообщение, результат которого читает другой модуль, наследует `Command<Результат>` или `Query<Результат>` из `@nestjs/cqrs`: тогда `execute` возвращает типизированный результат, а не `any`. Модуль-отправитель импортирует модуль-получатель (`AuthModule` → `UsersModule`). Шине это не нужно, она собирает обработчики со всех модулей, но так зависимость видна в графе модулей. Зависимость односторонняя, циклов быть не должно.
- **Новая операция** = сообщение + обработчик + регистрация + строка в контроллере (у операции, которую вызывают только другие модули, контроллера нет). События (`EventBus`) и саги пока не используются.

## Авторизация

Модуль `src/auth` (устройство операций — в разделе «CQRS») отвечает за учётные данные и токены: хеширование и проверку пароля (`password.ts`), подпись JWT (`TokenService`), проверку токена (`JwtAuthGuard`) и эндпоинты `/auth/*`. Пользователей он создаёт и ищет только через шину модуля `users` и к Prisma не обращается. Регистрация — команда `RegisterUserCommand` (`commands/`): `RegisterUserHandler` хеширует пароль, отправляет `CreateUserCommand` и выпускает токен. Логин — запрос `LoginQuery` (`queries/`, состояние не меняется): `LoginHandler` отправляет `FindUserByEmailQuery`, проверяет пароль и выпускает токен.

Эндпоинты: `POST /auth/register` (201) и `POST /auth/login` (200) принимают `{ email, password }` и возвращают `{ accessToken }`. JWT подписывается через `@nestjs/jwt` (HS256, payload `sub` и `email`, срок по умолчанию 7 суток). Email приводится к нижнему регистру в DTO. Пароль от 8 до 128 символов, хранится как scrypt-хеш (`node:crypto`, без нативных зависимостей). Дубликат email даёт 409 (его бросает `CreateUserHandler` модуля `users`), неверные данные входа 401 с одинаковым ответом для «нет пользователя» и «неверный пароль». Валидация (`ValidationPipe`) подключена через `APP_PIPE` в `AppModule`, а не в `main.ts`, чтобы действовать и в e2e-тестах.

Невалидное тело даёт 400, а `message` в ответе — массив сообщений class-validator, которые начинаются с имени поля (`email must be an email`). По этому префиксу web сопоставляет ошибки с полями формы регистрации, поэтому формат меняй осторожно. Браузер в api напрямую не ходит (web вызывает его с сервера), так что CORS в `main.ts` не включён: если появится прямой доступ из браузера, например WebSocket-сигналинг, его придётся включить.

## Пользователи

Модуль `src/users` хранит пользователей и ничего не знает об авторизации: контроллера у него нет, только два сообщения для других модулей. `CreateUserCommand(email, passwordHash)` создаёт пользователя и возвращает `UserView`, а при занятом email бросает `ConflictException` (409). `FindUserByEmailQuery(email)` возвращает `UserView` или `null`. Пароль приходит в модуль уже хешем: хеширует и проверяет его `auth`. Таблицы `users` через `PrismaService` касается только этот модуль, остальные ссылаются на пользователя по `id` (как `ownerId` у встреч). `UserView` содержит `passwordHash`, который нужен `auth` для проверки пароля, поэтому в ответы контроллеров его отдавать нельзя. Модуль `users` не должен импортировать `auth`.

## Встречи

Модуль `src/meetings`: `CreateMeetingCommand`, `ListMeetingsQuery`, `GetMeetingQuery` и их обработчики. Модель `Meeting` в Prisma (`title`, `date`, `participants` — массив строк, `ownerId`). Все роуты закрыты `JwtAuthGuard` (`src/auth/jwt-auth.guard.ts`: проверяет `Authorization: Bearer <jwt>`, кладёт `request.user = { id, email }`); текущего пользователя в контроллер отдаёт декоратор `@CurrentUser()`. Новым защищённым роутам добавляй `@UseGuards(JwtAuthGuard)`.

Эндпоинты: `POST /meetings` (201, тело `{ title, date, participants }`), `GET /meetings` (встречи текущего пользователя по возрастанию даты), `GET /meetings/:id` (404, если встречи нет или она чужая, чтобы не раскрывать её существование). Ответ: `{ id, title, date, participants }`. Без токена или с невалидным токеном — 401.

## ESM

- Относительные импорты пишутся с расширением `.js`, даже из `.ts`-файлов: `import { AuthModule } from './auth/auth.module.js'`.
- Подпути пакетов без поля `exports` тоже требуют расширения, иначе TypeScript их не найдёт: `import type { App } from 'supertest/types.js'`.
- В `src/main.ts` используется top-level `await`.

## Тесты и линтинг

- Vitest работает с `globals: true`: `describe`, `it`, `expect` и `vi` доступны без импорта. Типы подключены через `types` в `tsconfig.json`.
- Алиасы из `paths` в `tsconfig.json` Vitest резолвит сам (`resolve.tsconfigPaths: true` в обоих конфигах). Плагин `vite-tsconfig-paths` не нужен.
- ESLint 10 с `typescript-eslint` `recommendedTypeChecked`. Линтинг type-aware (`projectService`), поэтому файл вне `tsconfig.json` ESLint не разберёт. Шаблон Nest 12 по умолчанию ставит Oxlint, здесь вместо него осознанно выбран ESLint.
