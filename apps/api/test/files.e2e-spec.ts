import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

const PASSWORD = 'correct-horse-battery';

const uniqueEmail = () => `user-${randomUUID()}@example.com`;

const PDF_HEADER = Buffer.from('%PDF-1.7\n');

const pdf = (size: number) =>
  Buffer.concat([PDF_HEADER, randomBytes(size - PDF_HEADER.length)]);

const sha256 = (data: Buffer) =>
  createHash('sha256').update(data).digest('hex');

const dispositionFileName = (header: string | undefined) => {
  const match = /filename\*=UTF-8''([^;]+)/.exec(header ?? '');
  return match ? decodeURIComponent(match[1]) : undefined;
};

interface FileBody {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  createdAt: string;
}

describe('Files (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(0);
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

  async function createMeeting(token: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/meetings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: `Планёрка ${randomUUID()}`,
        date: '2030-01-15T10:00:00.000Z',
        participants: [],
      })
      .expect(201);
    return (res.body as { id: string }).id;
  }

  const uploadFile = (
    token: string,
    meetingId: string,
    name: string,
    data: Buffer,
  ) =>
    request(app.getHttpServer())
      .post(`/meetings/${meetingId}/files`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/octet-stream')
      .set('X-File-Name', encodeURIComponent(name))
      .send(data);

  const listFiles = (token: string, meetingId: string) =>
    request(app.getHttpServer())
      .get(`/meetings/${meetingId}/files`)
      .set('Authorization', `Bearer ${token}`);

  const downloadFile = (token: string, meetingId: string, fileId: string) =>
    request(app.getHttpServer())
      .get(`/meetings/${meetingId}/files/${fileId}`)
      .set('Authorization', `Bearer ${token}`)
      .responseType('blob');

  async function uploadOk(
    token: string,
    meetingId: string,
    name: string,
    data: Buffer,
  ): Promise<FileBody> {
    const res = await uploadFile(token, meetingId, name, data).expect(201);
    return res.body as FileBody;
  }

  describe('POST /meetings/:id/files', () => {
    it('сохраняет файл и возвращает его описание', async () => {
      const token = await registerUser();
      const meetingId = await createMeeting(token);
      const data = pdf(64 * 1024);

      const file = await uploadOk(token, meetingId, 'Отчёт за май.pdf', data);

      expect(file.id).toEqual(expect.any(String));
      expect(file.name).toBe('Отчёт за май.pdf');
      expect(file.size).toBe(data.length);
      expect(file.mimeType).toBe('application/pdf');
      expect(Number.isNaN(Date.parse(file.createdAt))).toBe(false);
    });

    it('указывает адрес созданного файла в Location', async () => {
      const token = await registerUser();
      const meetingId = await createMeeting(token);

      const res = await uploadFile(
        token,
        meetingId,
        'Файл.pdf',
        pdf(1024),
      ).expect(201);

      const { id } = res.body as FileBody;
      expect((res.headers as Record<string, string>).location).toBe(
        `/meetings/${meetingId}/files/${id}`,
      );
    });

    it('создаёт запись только после полного приёма файла', async () => {
      const token = await registerUser();
      const meetingId = await createMeeting(token);
      const data = pdf(256 * 1024);
      const half = data.length / 2;
      const { port } = (app.getHttpServer() as Server).address() as AddressInfo;

      const upload = httpRequest({
        port,
        method: 'POST',
        path: `/meetings/${meetingId}/files`,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
          'Content-Length': data.length,
          'X-File-Name': encodeURIComponent('Запись.pdf'),
        },
      });
      const status = new Promise<number | undefined>((resolve, reject) => {
        upload.on('response', (res) => {
          res.resume();
          resolve(res.statusCode);
        });
        upload.on('error', reject);
      });
      upload.write(data.subarray(0, half));
      await delay(100);

      await listFiles(token, meetingId).expect(200).expect([]);

      upload.end(data.subarray(half));
      expect(await status).toBe(201);
      const res = await listFiles(token, meetingId).expect(200);
      expect((res.body as FileBody[]).map((file) => file.size)).toEqual([
        data.length,
      ]);
    });

    it('возвращает 404, если встречу удалили во время загрузки', async () => {
      const token = await registerUser();
      const meetingId = await createMeeting(token);
      const data = pdf(64 * 1024);
      const half = data.length / 2;
      const { port } = (app.getHttpServer() as Server).address() as AddressInfo;

      const upload = httpRequest({
        port,
        method: 'POST',
        path: `/meetings/${meetingId}/files`,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
          'Content-Length': data.length,
          'X-File-Name': encodeURIComponent('Запись.pdf'),
        },
      });
      const status = new Promise<number | undefined>((resolve, reject) => {
        upload.on('response', (res) => {
          res.resume();
          resolve(res.statusCode);
        });
        upload.on('error', reject);
      });
      upload.write(data.subarray(0, half));
      await delay(100);

      await app.get(PrismaService).meeting.delete({ where: { id: meetingId } });
      upload.end(data.subarray(half));

      expect(await status).toBe(404);
    });

    it('возвращает 404 для встречи другого пользователя', async () => {
      const owner = await registerUser();
      const other = await registerUser();
      const meetingId = await createMeeting(owner);
      await uploadFile(owner, meetingId, 'Свой.pdf', pdf(1024)).expect(201);

      await uploadFile(other, meetingId, 'Чужой.pdf', pdf(1024)).expect(404);

      const res = await listFiles(owner, meetingId).expect(200);
      expect((res.body as FileBody[]).map((file) => file.name)).toEqual([
        'Свой.pdf',
      ]);
    });

    it('возвращает 404 для несуществующей встречи', async () => {
      const token = await registerUser();
      const meetingId = await createMeeting(token);
      await uploadFile(token, meetingId, 'Файл.pdf', pdf(1024)).expect(201);

      await uploadFile(token, randomUUID(), 'Файл.pdf', pdf(1024)).expect(404);
    });

    it('возвращает 401 без токена', async () => {
      const token = await registerUser();
      const meetingId = await createMeeting(token);

      await request(app.getHttpServer())
        .post(`/meetings/${meetingId}/files`)
        .set('Content-Type', 'application/octet-stream')
        .set('X-File-Name', 'file.pdf')
        .send(pdf(1024))
        .expect(401);
    });

    it.each([
      ['без названия', undefined],
      ['с пустым названием', '%20%20'],
      ['с названием в неверной кодировке', '%E0%A4%A'],
      ['с косой чертой в названии', 'docs%2Fplan.pdf'],
    ])(
      'возвращает 400 %s',
      async (_name: string, fileName: string | undefined) => {
        const token = await registerUser();
        const meetingId = await createMeeting(token);
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
        };
        if (fileName !== undefined) {
          headers['X-File-Name'] = fileName;
        }

        await request(app.getHttpServer())
          .post(`/meetings/${meetingId}/files`)
          .set(headers)
          .send(pdf(1024))
          .expect(400);
      },
    );

    it('возвращает 415 для тела не в application/octet-stream', async () => {
      const token = await registerUser();
      const meetingId = await createMeeting(token);

      await request(app.getHttpServer())
        .post(`/meetings/${meetingId}/files`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-File-Name', 'file.pdf')
        .send({ name: 'file.pdf' })
        .expect(415);
    });
    it('возвращает 411 для тела без Content-Length', async () => {
      const token = await registerUser();
      const meetingId = await createMeeting(token);
      const { port } = (app.getHttpServer() as Server).address() as AddressInfo;

      const upload = httpRequest({
        port,
        method: 'POST',
        path: `/meetings/${meetingId}/files`,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
          'Transfer-Encoding': 'chunked',
          'X-File-Name': 'file.pdf',
        },
      });
      const status = new Promise<number | undefined>((resolve, reject) => {
        upload.on('response', (res) => {
          res.resume();
          resolve(res.statusCode);
        });
        upload.on('error', reject);
      });
      upload.end(pdf(1024));

      expect(await status).toBe(411);
      await listFiles(token, meetingId).expect(200).expect([]);
    });
  });

  describe('GET /meetings/:id/files', () => {
    it('возвращает пустой список, если файлов нет', async () => {
      const token = await registerUser();
      const meetingId = await createMeeting(token);

      await listFiles(token, meetingId).expect(200).expect([]);
    });

    it('показывает одноимённые файлы отдельными строками, новые сверху', async () => {
      const token = await registerUser();
      const meetingId = await createMeeting(token);
      const name = 'Протокол встречи.pdf';
      const first = await uploadOk(token, meetingId, name, pdf(2048));
      const second = await uploadOk(token, meetingId, name, pdf(4096));

      const res = await listFiles(token, meetingId).expect(200);

      const files = res.body as FileBody[];
      expect(files.map((file) => file.id)).toEqual([second.id, first.id]);
      expect(files.map((file) => file.name)).toEqual([name, name]);
      expect(files.map((file) => file.size)).toEqual([4096, 2048]);
      expect(files.map((file) => file.createdAt)).toEqual([
        second.createdAt,
        first.createdAt,
      ]);
    });

    it('возвращает 404 для встречи другого пользователя', async () => {
      const owner = await registerUser();
      const other = await registerUser();
      const meetingId = await createMeeting(owner);
      await uploadOk(owner, meetingId, 'Свой.pdf', pdf(1024));
      await listFiles(owner, meetingId).expect(200);

      await listFiles(other, meetingId).expect(404);
    });

    it('возвращает 401 без токена', async () => {
      const token = await registerUser();
      const meetingId = await createMeeting(token);

      await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files`)
        .expect(401);
    });
  });

  describe('GET /meetings/:id/files/:fileId', () => {
    it('отдаёт файл байт в байт под исходным названием', async () => {
      const token = await registerUser();
      const meetingId = await createMeeting(token);
      const name = 'Отчёт за май 2030.pdf';
      const data = pdf(512 * 1024);
      const file = await uploadOk(token, meetingId, name, data);

      const res = await downloadFile(token, meetingId, file.id).expect(200);

      const headers = res.headers as Record<string, string>;
      expect(sha256(res.body as Buffer)).toBe(sha256(data));
      expect(headers['content-type']).toBe('application/pdf');
      expect(headers['content-disposition']).toMatch(/^attachment;/);
      expect(dispositionFileName(headers['content-disposition'])).toBe(name);
    });

    it('отдаёт текстовый файл с кодировкой в Content-Type', async () => {
      const token = await registerUser();
      const meetingId = await createMeeting(token);
      const data = Buffer.from('Повестка встречи');

      const file = await uploadOk(token, meetingId, 'Повестка.txt', data);
      const res = await downloadFile(token, meetingId, file.id).expect(200);

      expect(file.mimeType).toBe('text/plain');
      expect((res.headers as Record<string, string>)['content-type']).toBe(
        'text/plain; charset=utf-8',
      );
      expect(res.body as Buffer).toEqual(data);
    });

    it('возвращает 404 для файла встречи другого пользователя', async () => {
      const owner = await registerUser();
      const other = await registerUser();
      const meetingId = await createMeeting(owner);
      const file = await uploadOk(owner, meetingId, 'Свой.pdf', pdf(1024));
      await downloadFile(owner, meetingId, file.id).expect(200);

      await downloadFile(other, meetingId, file.id).expect(404);
    });

    it('возвращает 404 для несуществующего файла и файла другой встречи', async () => {
      const token = await registerUser();
      const meetingId = await createMeeting(token);
      const otherMeetingId = await createMeeting(token);
      const file = await uploadOk(token, meetingId, 'Файл.pdf', pdf(1024));
      await downloadFile(token, meetingId, file.id).expect(200);

      await downloadFile(token, meetingId, randomUUID()).expect(404);
      await downloadFile(token, otherMeetingId, file.id).expect(404);
    });

    it('возвращает 401 без токена', async () => {
      const token = await registerUser();
      const meetingId = await createMeeting(token);
      const file = await uploadOk(token, meetingId, 'Файл.pdf', pdf(1024));

      await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files/${file.id}`)
        .expect(401);
    });
  });

  describe('HTTP-сервер', () => {
    it('принимает тело запроса дольше пяти минут', () => {
      expect((app.getHttpServer() as Server).requestTimeout).toBe(
        60 * 60 * 1000,
      );
    });
  });
});
