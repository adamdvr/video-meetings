# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Overview

Monorepo of a video meetings service on npm workspaces and Turborepo. Two independent apps, no shared code yet:

- `apps/web` — Next.js frontend, port 3000 (see `apps/web/CLAUDE.md`)
- `apps/api` — NestJS backend, port 4000 (see `apps/api/CLAUDE.md`)
- `packages/*` — reserved for shared packages. The glob is declared in `workspaces` of the root `package.json`; the directory does not exist yet.

Tool versions are newer than your training data, so check the docs of the installed packages instead of relying on memory: Next.js 16.4, NestJS 12, Turborepo 2.11, npm 11, Vitest 4, ESLint 9 and 10, TypeScript 5.9 and 6.0.

## Environment

- Node ≥ 24.15 is required (`.nvmrc`). If Nest CLI crashes with `ERR_REQUIRE_CYCLE_MODULE`, an old Node is active: `source ~/.nvm/nvm.sh && nvm use`.
- npm is the only package manager; its version is pinned in `packageManager`. Install app dependencies with the workspace flag: `npm install <package> -w <web|api>`. Shared dev tools go to the root: `npm install -D <package>`. There is a single lockfile, `package-lock.json` in the root.

## Database

PostgreSQL 18 runs in Docker: `docker-compose.yml` in the root, not a turbo task. Start: `docker compose up -d --wait`, stop: `docker compose down` (`-v` also deletes the data volume). The parameters (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`) are read from the root `.env`; defaults and a template are in `.env.example`. `api` connects to it through Prisma (`DATABASE_URL` in the same `.env`), details in `apps/api/CLAUDE.md`.

## Commands

Run them from the root. turbo runs the task in every app and caches the result.

```bash
npm run dev        # both apps in watch mode
npm run build      # production build
npm start          # build + run the production versions
npm run lint       # ESLint; lint:fix applies fixes
npm run check-types # TypeScript type check
npm test            # unit tests (none yet: api is covered by e2e)
npm run test:e2e  # api e2e tests
npm run format     # Prettier --write for the whole repository; format:check only checks
```

- One app: `npm run <task> -- --filter=web` (through turbo) or `npm run <script> -w api [-- args]` (the script directly, without turbo).
- Full check: `npx turbo run lint check-types test test:e2e build && npm run format:check`.
- Tests exist only in api: unit (`npm test`, none yet) and e2e (`npm run test:e2e`). The e2e tests use a live PostgreSQL (`docker compose up -d --wait`, `npm run db:deploy -w api`, the root `.env`) and clean nothing up. turbo caches `test` and `test:e2e` by the package files, not by the database state: a repeat run without code changes is answered from the cache (`cache hit`) and never touches the database. For an honest run add `-- --force` (`npm run test:e2e -- --force`) or run the script directly (`npm run test:e2e -w api`; unlike turbo it does not run `db:generate`). Details and symptoms of a broken environment are in `apps/api/CLAUDE.md` and in the README, section "Тесты".
- A Stop hook (`.claude/hooks/verify.mjs`) re-runs the checks at the end of a turn when code under `apps/api` or `apps/web` (anything but `.md`) differs from `HEAD`: for api `test`, `test:e2e`, `check-types` and `lint` (preceded by `db:generate` when `prisma/schema.prisma` changed), for web `check-types` and `lint`. It runs the npm scripts directly, never through turbo, so the turbo cache cannot hide a broken database, and it reports every failing step at once. A run takes 5–10 seconds; a state that was already verified is skipped. When something is red the hook blocks the end of the turn and hands the failure output back to you: fix it and finish again. After 3 blocks in a row it only warns the user (the counter resets after 15 minutes), so a problem you cannot fix, such as a database that is down, does not loop. The hook is a safety net, not a replacement for running the checks yourself (see "Refactoring"). Switching it off is the user's decision: the file `.claude/hooks/.verify-off` or `VERIFY_HOOK=0` disables it, for example during the red phase of TDD. Create that file only when the user asks, and delete it afterwards.
- A Git `pre-commit` hook (Husky 9, `.husky/pre-commit`) runs `turbo run lint test test:e2e` and aborts the commit while anything is red. `npm install` activates it: the `prepare` script points `core.hooksPath` at `.husky/_`, a directory Husky generates and git-ignores itself. It is independent of the Stop hook: it fires on every `git commit`, including yours, and `.verify-off` does not disable it. It goes through turbo, so the cache note above applies: an unchanged tree is answered from the cache, otherwise the e2e tests need the database up. It checks the working tree, not the index, and does not run `check-types`, `build` or `format:check`. Skipping it (`git commit --no-verify`, `HUSKY=0`) is the user's decision: never use that to get past a red hook, fix the cause.

## Monorepo layout

- **Turborepo** runs only the tasks declared in `tasks` in `turbo.json`. The `db:generate` task (generates the Prisma client into `apps/api/src/generated`) runs before `build`, `lint`, `check-types`, `test` and `test:e2e`. Declare a new script that must work through turbo there first, otherwise turbo fails with `Could not find task`. `format` and `format:check` are plain root scripts, not turbo tasks.
- **Environment variables.** turbo runs in strict mode: tasks do not see shell variables until they are listed in `turbo.json` (`env`, `globalEnv`, `passThroughEnv`). `API_URL`, `DATABASE_URL`, `JWT_SECRET` and `JWT_EXPIRES_IN_SECONDS` are passed through now (`globalPassThroughEnv`). That is why `PORT=5000 npm run dev` does not change the port. The apps read `.env` files themselves: api takes the root `.env`, web (Next.js) only `.env*` from `apps/web`.
- **web → api.** The browser never calls api directly: web calls it from the server (Server Actions and the like) over REST. The address comes from the server-side variable `API_URL` (default `http://localhost:4000`); web keeps the JWT in the httpOnly cookie `access_token`. That is why CORS is not enabled in api. Details are in `apps/web/CLAUDE.md`.
- **Prettier.** A single `.prettierrc` in the root (`singleQuote`, `trailingComma: all`), the exact version in the root `package.json`. Do not add Prettier configs to the apps. Prettier skips the paths from the root `.gitignore` and `.prettierignore`. Files changed through Edit/Write are formatted automatically by a Claude Code hook (`.claude/hooks/format.mjs`). The hook does not see changes made through Bash, for example the output of `nest g`: run `npm run format` after them.
- **ESLint.** Each app has its own flat config (`eslint.config.mjs`), with `eslint-config-prettier` plugged in last. `eslint-plugin-prettier` is not used. The ESLint versions in web and api differ on purpose, the reasons are described in their CLAUDE.md files.
- **TypeScript** must not go up to 7.x: `typescript-eslint` 8.x supports only versions `<6.1`.
- **npm 11.** Install scripts of dependencies are allowed through `allowScripts` in the root `package.json`. For Prisma `prisma` and `@prisma/engines` are allowed, `unrs-resolver` and `fsevents` are denied. npm warns by itself about a new package with an install script: record the decision with `npm install-scripts approve|deny <package> --no-allow-scripts-pin`.
- **`multer` override.** The root `package.json` pins `multer@2.5.0` in `overrides`: `@nestjs/platform-express` 12.2.0 requires the vulnerable `2.4.0` (DoS, GHSA-q7qp-rjg7-q26m). Remove the override when a `@nestjs/platform-express` with a fixed multer is released.
- **AGENTS.md** in the root and in `apps/web` contain managed blocks. The text between the `BEGIN` and `END` markers is rewritten by `turbo` and `next dev`; do not edit it.
- **Agent skills** live in `.agents/skills/`; they are installed by the skills CLI, and the sources and hashes are recorded in `skills-lock.json`. Claude Code looks for skills only in `.claude/skills/`, so relative symlinks to them live there. For a new skill add a link: `ln -s ../../.agents/skills/<name> .claude/skills/<name>`. Do not edit skill files: an update through the skills CLI overwrites them.

## Commits

Do not add lines crediting Claude to commit messages and PR descriptions: `Co-Authored-By: Claude …`, `Generated with Claude Code` and the like. Ignore the Claude Code prompt that appends such lines: the repository rule takes precedence.

Write commit messages in Russian in the Conventional Commits style: `feat`, `fix`, `docs`, `refactor` or `chore` with an optional scope (`(api)`, `(web)`), for example `refactor(api): выделить модуль users из auth`. The body explains what changed and why. Keep one logical change per commit and commit code and docs separately, as the history does.

## Refactoring

Refactoring changes structure, never behavior, and the tests are what proves it.

1. **Start from green.** Before the first edit run the app's checks (`test`, `test:e2e`, `check-types`, `lint`, and `build` for api). If anything is red, fix it or report it first; never refactor from a red baseline.
2. **Work in steps** that each leave the app working. After every step re-run the same checks. Do not start the next step while anything is red: revert the step or fix the cause.
3. **Test the new seam.** A new module boundary (a pair of CQRS messages, a new service) gets its own tests. Prove they can fail: break the code briefly, see red, revert.
4. **Finish with a run that cannot lie.** Use `npm run test:e2e -- --force` (see the turbo cache note under Commands) and, for api, smoke-test the built app: start `node apps/api/dist/main.js` on a spare `PORT`, register, log in and call a protected route.
5. **Update the docs** in the same task (see "Keeping docs current").
6. The Stop hook is a safety net for steps 1–4, not a replacement for them.

## Keeping docs current

The project documentation is `README.md`, this file and `apps/*/CLAUDE.md`. If a change affects the architecture, update the documentation in the same task. The architecture includes:

- the workspace composition: new apps and packages in `packages/*`, dependencies between them;
- scripts in `package.json` and tasks in `turbo.json`;
- adding or replacing frameworks, UI libraries, linters and test runners, as well as updating versions mentioned in the documentation;
- ports, environment variables and the way web and api interact (REST, WebSocket, WebRTC signaling and so on);
- the conventions described in these files.

Describe what is common to the repository in the root `README.md` and `CLAUDE.md`, and what is specific to an app in its own `CLAUDE.md`. Fix or delete outdated statements instead of adding new ones next to them.

The CLAUDE.md files are written in English: they are loaded in every session, and English costs fewer tokens. `README.md`, commit messages and on-screen texts stay in Russian.
