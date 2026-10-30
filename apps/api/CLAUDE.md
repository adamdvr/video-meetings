# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## apps/api

Backend on NestJS 12 (Express platform) and TypeScript 6.0. The package is ESM: `"type": "module"`, `module: nodenext`. The port 4000 is set as `process.env.PORT ?? 4000` in `src/main.ts`. When started through turbo, `PORT` from the shell is not passed through.

## Commands

Run as `npm run <script> -w api` from the root or through turbo: `npm run <task> -- --filter=api`.

- `dev` — `nest start --watch`; `start:debug` — the same with the inspector; `start` — `node dist/main`, requires `build` first.
- `build` — `nest build` using `tsconfig.build.json`. Builds only `src/` without specs, the result is `dist/main.js`.
- `test` — unit tests on Vitest 4 (`src/**/*.spec.ts`). There are none yet: api behavior is verified by the e2e tests, and `passWithNoTests` in `vitest.config.ts` keeps the task from failing when there are no files. One file: `npm run test -w api -- src/<path>.spec.ts`. By test name: `npm run test -w api -- -t "<name>"`. There are also `test:watch`, `test:cov` and `test:debug` (`--inspect-brk`, files are not run in parallel); all three use the unit config.
- `test:e2e` — e2e tests (`test/**/*.e2e-spec.ts`, config `vitest.config.e2e.ts`). Needs a running PostgreSQL with migrations applied (`docker compose up -d --wait`, `db:deploy`); the tests leave `user-<uuid>@example.com` users in the database. A file and a test name are passed the same way as for `test`: `npm run test:e2e -w api -- test/auth.e2e-spec.ts -t "<name>"`. Through turbo the result is cached by files, not by the database state; add `--force` for an honest run. The scripts have no watch mode for e2e: `npm exec -w api -- vitest --config vitest.config.e2e.ts`. What the typical environment errors mean (no `.env`, database is down, no migrations) is described in the README, section "Тесты".
- Code generation: `npm exec -w api -- nest g <schematic> <name>` (module, controller, service, etc.). The generator writes ESM code with Vitest specs and registers the module in `AppModule`, but the output is not formatted. Run `npm run format` after generating.

## Database and Prisma

- Prisma 7 with the driver adapter `@prisma/adapter-pg`. The schema is in `prisma/schema.prisma`, migrations in `prisma/migrations`, config in `prisma.config.ts`. The versions of `prisma` and `@prisma/client` are pinned exactly: `latest` on npm is 8.0 RC right now.
- The client is generated into `src/generated/prisma` (not committed to git, skipped by ESLint). Generation: `db:generate`; it also runs in `postinstall` and in turbo before the other tasks. After changing the schema: `db:migrate` (dev, creates a migration) and `db:deploy` (applies the existing ones).
- `PrismaService` (global `PrismaModule`) extends `PrismaClient`.
- Configuration is read in `src/config/configuration.ts`: on import it loads the root `.env` (`process.loadEnvFile`, environment variables take priority), `getConfig()` requires `DATABASE_URL` and `JWT_SECRET`. Tests and `nest start` take them from `.env`; without it the variables must be in the environment.

## Modules

`AppModule` (`src/app.module.ts`) only assembles the app: it imports the modules below and registers the global `ValidationPipe` through `APP_PIPE`. It has no controllers or services of its own, so the root `GET /` responds with 404. Add a new module to its `imports`.

- `PrismaModule` (`src/prisma`, global): `PrismaService`, the database client. There is no need to import it into other modules.
- `AuthModule` (`src/auth`): the `/auth/*` endpoints, passwords and JWT, `JwtAuthGuard` and `@CurrentUser()`; see "Auth". Its `JwtModule` is registered as global, so `JwtAuthGuard` works in any module without importing `AuthModule`. Depends on `UsersModule`.
- `UsersModule` (`src/users`): creating and finding users, messages for other modules only; see "Users". Does not depend on other feature modules.
- `MeetingsModule` (`src/meetings`): the current user's meetings, `/meetings`; see "Meetings". Takes `JwtAuthGuard` and `@CurrentUser()` from `auth` (a file import, not a module import).

Dependencies go one way: `meetings` → `auth` → `users`. Another module's data is obtained through the bus, the rules are in the "CQRS" section.

## CQRS

Business operations of api are built on `@nestjs/cqrs` (modules `auth`, `users` and `meetings`). A controller has no logic: it takes a DTO, builds a message and sends it to the bus (`CommandBus` or `QueryBus`), and returns whatever the handler returned.

- **A command** changes state (creates, updates, deletes), **a query** only reads. This is the criterion, not the HTTP method: `POST /auth/login` writes nothing to the database, so it is a `LoginQuery`.
- **A message** is a class with `public readonly` constructor parameters, primitives and dates only, no logic. Names: `<Verb><Entity>Command` and `<Verb><Entity>Query`, files `commands/*.command.ts` and `queries/*.query.ts`.
- **A handler** (`@CommandHandler` or `@QueryHandler`, next to the message, file `*.handler.ts`) is one operation per class. It works with `PrismaService` and other services, throws Nest exceptions (`NotFoundException`, `ConflictException`, `UnauthorizedException`) and returns a ready response (for meetings it is `MeetingView`, not a Prisma model). A `Find…` query (`FindUserByEmailQuery`) returns `null` when there is no data instead of throwing `NotFoundException`: the calling module decides what that means (login answers 401, not 404).
- **Who acts and on what** is passed in the message explicitly: for example, `ownerId` in the meeting queries comes from `@CurrentUser()` in the controller. A handler does not read the HTTP request.
- **Form validation** of the data is in the controller DTO (`class-validator`), domain rules are in the handler.
- **Registration.** A module imports `CqrsModule`, and every handler goes into `providers`. Without it the message goes to the bus and the bus throws a missing-handler error.
- **Links between modules.** A module works with another module's data only through the bus: its handler sends the other module's message and does not reach into foreign tables and services (this is how `auth` talks to `users`). The module's contract is its messages and the result type. A message whose result is read by another module extends `Command<Result>` or `Query<Result>` from `@nestjs/cqrs`: then `execute` returns a typed result instead of `any`. The sending module imports the receiving module (`AuthModule` → `UsersModule`). The bus does not need this, it collects handlers from all modules, but the dependency becomes visible in the module graph. The dependency is one-directional, there must be no cycles.
- **A new operation** = message + handler + registration + a line in the controller (an operation that only other modules call has no controller). Events (`EventBus`) and sagas are not used yet.

## Auth

The `src/auth` module (how operations are built is in the "CQRS" section) is responsible for credentials and tokens: hashing and verifying the password (`password.ts`), signing the JWT (`TokenService`), verifying the token (`JwtAuthGuard`) and the `/auth/*` endpoints. It creates and finds users only through the bus of the `users` module and does not touch Prisma. Registration is the command `RegisterUserCommand` (`commands/`): `RegisterUserHandler` hashes the password, sends `CreateUserCommand` and issues a token. Login is the query `LoginQuery` (`queries/`, it changes no state): `LoginHandler` sends `FindUserByEmailQuery`, verifies the password and issues a token.

Endpoints: `POST /auth/register` (201) and `POST /auth/login` (200) take `{ email, password }` and return `{ accessToken }`. The JWT is signed through `@nestjs/jwt` (HS256, payload `sub` and `email`, default lifetime 7 days). The email is lowercased in the DTO. The password is 8 to 128 characters and is stored as a scrypt hash (`node:crypto`, no native dependencies). A duplicate email gives 409 (thrown by `CreateUserHandler` of the `users` module), wrong credentials give 401 with an identical response for "no such user" and "wrong password". Validation (`ValidationPipe`) is registered through `APP_PIPE` in `AppModule`, not in `main.ts`, so that it also applies in e2e tests.

An invalid body gives 400, and `message` in the response is an array of class-validator messages that start with the field name (`email must be an email`). web maps errors to the registration form fields by this prefix, so change the format carefully. The browser never calls api directly (web calls it from the server), so CORS is not enabled in `main.ts`: if direct browser access appears, for example WebSocket signaling, it will have to be enabled.

## Users

The `src/users` module stores users and knows nothing about auth: it has no controller, only two messages for other modules. `CreateUserCommand(email, passwordHash)` creates a user and returns `UserView`, and throws `ConflictException` (409) when the email is taken. `FindUserByEmailQuery(email)` returns `UserView` or `null`. The password arrives in the module already hashed: `auth` hashes and verifies it. Only this module touches the `users` table through `PrismaService`; the others refer to a user by `id` (like `ownerId` of a meeting). `UserView` contains `passwordHash`, which `auth` needs to verify the password, so it must never be returned in controller responses. The `users` module must not import `auth`.

## Meetings

The `src/meetings` module: `CreateMeetingCommand`, `ListMeetingsQuery`, `GetMeetingQuery` and their handlers. The `Meeting` model in Prisma (`title`, `date`, `participants` — an array of strings, `ownerId`). All routes are protected by `JwtAuthGuard` (`src/auth/jwt-auth.guard.ts`: checks `Authorization: Bearer <jwt>`, puts `request.user = { id, email }`); the `@CurrentUser()` decorator passes the current user to the controller. Add `@UseGuards(JwtAuthGuard)` to new protected routes.

Endpoints: `POST /meetings` (201, body `{ title, date, participants }`), `GET /meetings` (the current user's meetings by ascending date), `GET /meetings/:id` (404 if the meeting does not exist or belongs to someone else, so that its existence is not revealed). Response: `{ id, title, date, participants }`. Without a token or with an invalid one — 401.

## ESM

- Relative imports are written with the `.js` extension, even from `.ts` files: `import { AuthModule } from './auth/auth.module.js'`.
- Package subpaths without an `exports` field also need the extension, otherwise TypeScript cannot find them: `import type { App } from 'supertest/types.js'`.
- `src/main.ts` uses top-level `await`.

## Tests and linting

- Vitest runs with `globals: true`: `describe`, `it`, `expect` and `vi` are available without imports. The types are connected through `types` in `tsconfig.json`.
- Vitest resolves the aliases from `paths` in `tsconfig.json` itself (`resolve.tsconfigPaths: true` in both configs). The `vite-tsconfig-paths` plugin is not needed.
- Configs. `vitest.config.ts` picks up `**/*.spec.ts` (unit), `vitest.config.e2e.ts` picks up `**/*.e2e-spec.ts` (the `test/` directory). Specs and the `test` directory are excluded from the build in `tsconfig.build.json`. Vitest runs test files in parallel (`test:debug` turns this off with `--no-file-parallelism`).
- Structure of an e2e test. A file `test/<name>.e2e-spec.ts`: `beforeAll` starts the whole app (`Test.createTestingModule({ imports: [AppModule] })`, `createNestApplication()`, `init()`), `afterAll` calls `app.close()`. HTTP is checked through `supertest` (`request(app.getHttpServer())`), a module contract without HTTP — through the buses: `app.get(CommandBus)`, `app.get(QueryBus)` (example — `test/users.e2e-spec.ts`). `main.ts` takes no part in e2e, so register everything the app cannot work without, for example `ValidationPipe`, in `AppModule`.
- Data in e2e. The database is shared with the dev environment and is not cleaned. Every test creates its own data with a unique email (`user-${randomUUID()}@example.com`) and checks only that data: files run in parallel, and the tables always contain other people's rows. Do not reset tables in tests.
- ESLint 10 with `typescript-eslint` `recommendedTypeChecked`. Linting is type-aware (`projectService`), so ESLint cannot parse a file outside `tsconfig.json`. The Nest 12 template installs Oxlint by default; ESLint was chosen here deliberately instead.
