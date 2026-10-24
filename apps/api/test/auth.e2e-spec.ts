import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

const PASSWORD = 'correct-horse-battery';

// Каждый тест работает с уникальным email, поэтому очистка БД между тестами не нужна.
const uniqueEmail = () => `user-${randomUUID()}@example.com`;

const tokenOf = (res: request.Response) =>
  (res.body as { accessToken?: string }).accessToken;

function decodeJwt(token: string) {
  const [header, payload, signature] = token.split('.');
  const parse = (part: string) =>
    JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
  return {
    header: parse(header),
    payload: parse(payload),
    signature,
  };
}

function expectValidJwt(token: unknown) {
  expect(token).toEqual(expect.any(String));
  expect((token as string).split('.')).toHaveLength(3);

  const { header, payload, signature } = decodeJwt(token as string);
  expect(header.alg).toBeDefined();
  expect(signature).not.toBe('');
  expect(payload.sub).toBeDefined();
  expect(payload.exp).toEqual(expect.any(Number));
  expect(payload.exp as number).toBeGreaterThan(Date.now() / 1000);
  return payload;
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  // Валидацию (ValidationPipe) нужно подключать в AppModule (APP_PIPE),
  // а не в main.ts, иначе она не попадёт в приложение, поднятое тестом.
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const register = (body: object) =>
    request(app.getHttpServer()).post('/auth/register').send(body);
  const login = (body: object) =>
    request(app.getHttpServer()).post('/auth/login').send(body);

  describe('POST /auth/register', () => {
    it('создаёт пользователя и возвращает JWT', async () => {
      const email = uniqueEmail();

      const res = await register({ email, password: PASSWORD }).expect(201);

      const payload = expectValidJwt(tokenOf(res));
      expect(payload.email).toBe(email);
    });

    it('не возвращает пароль или его хеш', async () => {
      const res = await register({
        email: uniqueEmail(),
        password: PASSWORD,
      }).expect(201);

      expect(Object.keys(res.body as object)).toEqual(['accessToken']);
      expect(JSON.stringify(res.body)).not.toContain(PASSWORD);
    });

    it('после регистрации можно войти с теми же данными', async () => {
      const email = uniqueEmail();
      await register({ email, password: PASSWORD }).expect(201);

      await login({ email, password: PASSWORD }).expect(200);
    });

    it('токены регистрации и логина относятся к одному пользователю', async () => {
      const email = uniqueEmail();
      const registered = await register({ email, password: PASSWORD });
      const loggedIn = await login({ email, password: PASSWORD });

      expect(decodeJwt(tokenOf(loggedIn)!).payload.sub).toBe(
        decodeJwt(tokenOf(registered)!).payload.sub,
      );
    });

    it('возвращает 409 при регистрации уже существующего email', async () => {
      const email = uniqueEmail();
      await register({ email, password: PASSWORD }).expect(201);

      await register({ email, password: 'another-password-1' }).expect(409);
    });

    it('считает email регистронезависимым', async () => {
      const email = uniqueEmail();
      await register({ email, password: PASSWORD }).expect(201);

      await register({ email: email.toUpperCase(), password: PASSWORD }).expect(
        409,
      );
    });

    it.each([
      ['без email', { password: PASSWORD }],
      ['без пароля', { email: 'no-password@example.com' }],
      ['с пустым телом', {}],
      ['с невалидным email', { email: 'not-an-email', password: PASSWORD }],
      ['с email не строкой', { email: 123, password: PASSWORD }],
      [
        'с паролем не строкой',
        { email: 'num-pass@example.com', password: 12345678 },
      ],
      [
        'со слишком коротким паролем',
        { email: 'short@example.com', password: '123' },
      ],
    ])('возвращает 400 %s', async (_name: string, body: object) => {
      await register(body).expect(400);
    });

    it('не создаёт пользователя при невалидных данных', async () => {
      const email = uniqueEmail();
      await register({ email, password: '123' }).expect(400);

      await login({ email, password: '123' }).expect(401);
    });
  });

  describe('POST /auth/login', () => {
    it('возвращает JWT для существующего пользователя', async () => {
      const email = uniqueEmail();
      await register({ email, password: PASSWORD }).expect(201);

      const res = await login({ email, password: PASSWORD }).expect(200);

      const payload = expectValidJwt(tokenOf(res));
      expect(payload.email).toBe(email);
    });

    it('не регистрирует пользователя, если его нет в базе', async () => {
      const email = uniqueEmail();

      await login({ email, password: PASSWORD }).expect(401);
      // Повторная попытка тоже 401: пользователь не был создан логином.
      await login({ email, password: PASSWORD }).expect(401);
      // А регистрация с этим email по-прежнему проходит.
      await register({ email, password: PASSWORD }).expect(201);
    });

    it('принимает email в другом регистре', async () => {
      const email = uniqueEmail();
      await register({ email, password: PASSWORD }).expect(201);

      await login({ email: email.toUpperCase(), password: PASSWORD }).expect(
        200,
      );
    });

    it('возвращает 401 при неверном пароле', async () => {
      const email = uniqueEmail();
      await register({ email, password: PASSWORD }).expect(201);

      const res = await login({ email, password: 'wrong-password-1' }).expect(
        401,
      );
      expect(tokenOf(res)).toBeUndefined();
    });

    it('отвечает одинаково на неверный пароль и несуществующий email', async () => {
      const email = uniqueEmail();
      await register({ email, password: PASSWORD }).expect(201);

      const wrongPassword = await login({
        email,
        password: 'wrong-password-1',
      });
      const unknownUser = await login({
        email: uniqueEmail(),
        password: 'wrong-password-1',
      });

      // Ответы не должны позволять узнать, зарегистрирован ли email.
      expect(unknownUser.status).toBe(wrongPassword.status);
      expect(unknownUser.body).toEqual(wrongPassword.body);
    });

    it.each([
      ['без email', { password: PASSWORD }],
      ['без пароля', { email: 'no-password@example.com' }],
      ['с пустым телом', {}],
      ['с невалидным email', { email: 'not-an-email', password: PASSWORD }],
      ['с email не строкой', { email: 123, password: PASSWORD }],
      [
        'с паролем не строкой',
        { email: 'num-pass@example.com', password: 12345678 },
      ],
    ])('возвращает 400 %s', async (_name: string, body: object) => {
      await login(body).expect(400);
    });
  });
});
