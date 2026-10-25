import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

const PASSWORD = 'correct-horse-battery';

// Каждый тест работает с уникальными пользователями и встречами, поэтому очистка БД не нужна.
const uniqueEmail = () => `user-${randomUUID()}@example.com`;

interface MeetingBody {
  id: string;
  title: string;
  date: string;
  participants: string[];
}

describe('Meetings (e2e)', () => {
  let app: INestApplication<App>;

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

  async function registerUser(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: uniqueEmail(), password: PASSWORD })
      .expect(201);
    return (res.body as { accessToken: string }).accessToken;
  }

  const newMeeting = (overrides: object = {}) => ({
    title: `Планёрка ${randomUUID()}`,
    date: '2030-01-15T10:00:00.000Z',
    participants: ['alice@example.com', 'bob@example.com'],
    ...overrides,
  });

  const createMeeting = (token: string, body: object) =>
    request(app.getHttpServer())
      .post('/meetings')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  const listMeetings = (token: string) =>
    request(app.getHttpServer())
      .get('/meetings')
      .set('Authorization', `Bearer ${token}`);
  const getMeeting = (token: string, id: string) =>
    request(app.getHttpServer())
      .get(`/meetings/${id}`)
      .set('Authorization', `Bearer ${token}`);

  describe('POST /meetings', () => {
    it('создаёт встречу и возвращает её с id', async () => {
      const token = await registerUser();
      const body = newMeeting();

      const res = await createMeeting(token, body).expect(201);

      const meeting = res.body as MeetingBody;
      expect(meeting.id).toEqual(expect.any(String));
      expect(meeting.title).toBe(body.title);
      expect(new Date(meeting.date).toISOString()).toBe(body.date);
      expect(meeting.participants).toEqual(body.participants);
    });

    it('создаёт встречу без участников', async () => {
      const token = await registerUser();

      const res = await createMeeting(
        token,
        newMeeting({ participants: [] }),
      ).expect(201);

      expect((res.body as MeetingBody).participants).toEqual([]);
    });

    it('сохраняет встречу: её можно получить по id', async () => {
      const token = await registerUser();
      const created = await createMeeting(token, newMeeting()).expect(201);
      const { id } = created.body as MeetingBody;

      const res = await getMeeting(token, id).expect(200);

      expect(res.body).toEqual(created.body);
    });

    it('возвращает 401 без токена', async () => {
      await request(app.getHttpServer())
        .post('/meetings')
        .send(newMeeting())
        .expect(401);
    });

    it('возвращает 401 с невалидным токеном', async () => {
      await createMeeting('not-a-jwt', newMeeting()).expect(401);
    });

    it.each([
      ['без названия', { title: undefined }],
      ['с пустым названием', { title: '' }],
      ['с названием не строкой', { title: 123 }],
      ['без даты', { date: undefined }],
      ['с невалидной датой', { date: 'not-a-date' }],
      ['без списка участников', { participants: undefined }],
      ['со списком участников не массивом', { participants: 'alice' }],
      ['с участниками не строками', { participants: [1, 2] }],
    ])('возвращает 400 %s', async (_name: string, overrides: object) => {
      const token = await registerUser();

      await createMeeting(token, newMeeting(overrides)).expect(400);
    });

    it('не создаёт встречу при невалидных данных', async () => {
      const token = await registerUser();
      await createMeeting(token, newMeeting({ title: '' })).expect(400);

      const res = await listMeetings(token).expect(200);

      expect(res.body).toEqual([]);
    });
  });

  describe('GET /meetings', () => {
    it('возвращает пустой список, если встреч нет', async () => {
      const token = await registerUser();

      const res = await listMeetings(token).expect(200);

      expect(res.body).toEqual([]);
    });

    it('возвращает все встречи текущего пользователя', async () => {
      const token = await registerUser();
      const first = await createMeeting(token, newMeeting()).expect(201);
      const second = await createMeeting(token, newMeeting()).expect(201);

      const res = await listMeetings(token).expect(200);

      const ids = (res.body as MeetingBody[]).map((m) => m.id);
      expect(ids).toHaveLength(2);
      expect(ids).toEqual(
        expect.arrayContaining([
          (first.body as MeetingBody).id,
          (second.body as MeetingBody).id,
        ]),
      );
    });

    it('не показывает встречи других пользователей', async () => {
      const owner = await registerUser();
      const other = await registerUser();
      await createMeeting(owner, newMeeting()).expect(201);
      const mine = await createMeeting(other, newMeeting()).expect(201);

      const res = await listMeetings(other).expect(200);

      const ids = (res.body as MeetingBody[]).map((m) => m.id);
      expect(ids).toEqual([(mine.body as MeetingBody).id]);
    });

    it('возвращает 401 без токена', async () => {
      await request(app.getHttpServer()).get('/meetings').expect(401);
    });
  });

  describe('GET /meetings/:id', () => {
    it('возвращает встречу по id', async () => {
      const token = await registerUser();
      const body = newMeeting();
      const created = await createMeeting(token, body).expect(201);
      const { id } = created.body as MeetingBody;

      const res = await getMeeting(token, id).expect(200);

      const meeting = res.body as MeetingBody;
      expect(meeting.id).toBe(id);
      expect(meeting.title).toBe(body.title);
      expect(new Date(meeting.date).toISOString()).toBe(body.date);
      expect(meeting.participants).toEqual(body.participants);
    });

    it('возвращает 404, если встреча не найдена', async () => {
      const token = await registerUser();
      // Модуль должен работать: иначе 404 вернёт и отсутствующий роут.
      await createMeeting(token, newMeeting()).expect(201);

      await getMeeting(token, randomUUID()).expect(404);
    });

    it('возвращает 404 для id в неверном формате', async () => {
      const token = await registerUser();
      // Модуль должен работать: иначе 404 вернёт и отсутствующий роут.
      await createMeeting(token, newMeeting()).expect(201);

      await getMeeting(token, 'not-a-uuid').expect(404);
    });

    it('возвращает 404 для встречи другого пользователя', async () => {
      const owner = await registerUser();
      const other = await registerUser();
      const created = await createMeeting(owner, newMeeting()).expect(201);

      await getMeeting(other, (created.body as MeetingBody).id).expect(404);
    });

    it('возвращает 401 без токена', async () => {
      const token = await registerUser();
      const created = await createMeeting(token, newMeeting()).expect(201);

      await request(app.getHttpServer())
        .get(`/meetings/${(created.body as MeetingBody).id}`)
        .expect(401);
    });
  });
});
