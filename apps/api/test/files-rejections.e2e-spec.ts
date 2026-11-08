import { randomBytes, randomUUID } from 'node:crypto';
import { readdir, rm } from 'node:fs/promises';
import {
  request as httpRequest,
  type IncomingHttpHeaders,
  type OutgoingHttpHeaders,
  type Server,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

const FILES_DIR = join(tmpdir(), `video-meetings-e2e-${randomUUID()}`);

const ONE_GIB = 1024 ** 3;

const withHead = (head: Buffer | string, size = 1024) => {
  const start = Buffer.from(head as string, 'latin1');
  return Buffer.concat([start, randomBytes(size - start.length)]);
};

const SAMPLES: [string, Buffer][] = [
  ['Запись.mp4', withHead('\x00\x00\x00\x18ftypmp42')],
  ['Запись.webm', withHead('\x1a\x45\xdf\xa3')],
  ['Запись.mov', withHead('\x00\x00\x00\x14ftypqt  ')],
  ['Старая запись.mov', withHead('\x00\x00\x00\x08wide')],
  ['Звонок.mp3', withHead('ID3\x04\x00')],
  ['Звонок без тегов.mp3', withHead('\xff\xfb\x90\x64')],
  ['Звонок.m4a', withHead('\x00\x00\x00\x20ftypM4A ')],
  ['Звонок.wav', withHead('RIFF\x24\x00\x00\x00WAVE')],
  ['Звонок.ogg', withHead('OggS\x00\x02')],
  ['Отчёт.pdf', withHead('%PDF-1.7\n')],
  ['Отчёт.docx', withHead('PK\x03\x04')],
  ['Слайды.pptx', withHead('PK\x03\x04')],
  ['Таблица.xlsx', withHead('PK\x03\x04')],
  ['Заметки.txt', Buffer.from('Итоги встречи')],
  ['Схема.png', withHead('\x89PNG\r\n\x1a\n')],
  ['Фото.jpg', withHead('\xff\xd8\xff\xe0')],
  ['Фото.jpeg', withHead('\xff\xd8\xff\xe1')],
  ['Фото.webp', withHead('RIFF\x24\x00\x00\x00WEBP')],
  ['Анимация.gif', withHead('GIF89a')],
];

const PDF = SAMPLES.find(([name]) => name.endsWith('.pdf'))![1];
const PNG = SAMPLES.find(([name]) => name.endsWith('.png'))![1];

interface FileBody {
  id: string;
  name: string;
}

interface RawResponse {
  status?: number;
  headers: IncomingHttpHeaders;
  body: string;
}

async function entries(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

async function waitUntilEmpty(dir: string) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if ((await entries(dir)).length === 0) return;
    await delay(50);
  }
}

describe('Files: rejected and interrupted uploads (e2e)', () => {
  let app: INestApplication<App>;
  let port: number;

  beforeAll(async () => {
    process.env.FILES_DIR = FILES_DIR;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(0);
    port = ((app.getHttpServer() as Server).address() as AddressInfo).port;
  });

  afterAll(async () => {
    await app.close();
    await rm(FILES_DIR, { recursive: true, force: true });
  });

  async function registerUser(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `user-${randomUUID()}@example.com`,
        password: 'correct-horse-battery',
      })
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

  async function setUp() {
    const token = await registerUser();
    const meetingId = await createMeeting(token);
    return { token, meetingId };
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

  async function fileNames(token: string, meetingId: string) {
    const res = await request(app.getHttpServer())
      .get(`/meetings/${meetingId}/files`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return (res.body as FileBody[]).map((file) => file.name);
  }

  function startUpload(headers: OutgoingHttpHeaders, meetingId: string) {
    const upload = httpRequest({
      port,
      method: 'POST',
      path: `/meetings/${meetingId}/files`,
      headers: {
        'Content-Type': 'application/octet-stream',
        ...headers,
      },
    });
    const response = new Promise<RawResponse>((resolve) => {
      const timer = setTimeout(() => resolve({ headers: {}, body: '' }), 2000);
      upload.on('error', () => {
        clearTimeout(timer);
        resolve({ headers: {}, body: '' });
      });
      upload.on('response', (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => (body += chunk));
        res.on('end', () => {
          clearTimeout(timer);
          resolve({ status: res.statusCode, headers: res.headers, body });
        });
      });
    });
    return { upload, response };
  }

  describe('формат', () => {
    it.each(SAMPLES)('принимает %s', async (name, data) => {
      const { token, meetingId } = await setUp();

      await uploadFile(token, meetingId, name, data).expect(201);

      expect(await fileNames(token, meetingId)).toEqual([name]);
    });

    it.each([
      'Скрипт.exe',
      'Страница.html',
      'Рисунок.svg',
      'Архив.zip',
      'README',
    ])('отклоняет %s с 415 и не сохраняет его', async (name) => {
      const { token, meetingId } = await setUp();
      await uploadFile(token, meetingId, 'Заметки.txt', PDF).expect(201);

      const res = await uploadFile(token, meetingId, name, PDF).expect(415);

      expect(res.body).toMatchObject({
        message: 'File format is not allowed',
      });
      expect(await fileNames(token, meetingId)).toEqual(['Заметки.txt']);
      expect(await entries(join(FILES_DIR, meetingId))).toHaveLength(1);
    });

    it('отклоняет файл, содержимое которого не совпадает с форматом', async () => {
      const { token, meetingId } = await setUp();
      await uploadFile(token, meetingId, 'Отчёт.pdf', PDF).expect(201);

      const png = withHead(PNG.subarray(0, 8), 4 * 1024 * 1024);

      const res = await uploadFile(token, meetingId, 'Схема.pdf', png).expect(
        415,
      );

      expect(res.body).toMatchObject({
        message: 'File content does not match its format',
      });
      expect(await fileNames(token, meetingId)).toEqual(['Отчёт.pdf']);
      expect(await entries(join(FILES_DIR, meetingId))).toHaveLength(1);
      expect(await entries(join(FILES_DIR, '.tmp'))).toEqual([]);
    });

    it('отклоняет файл короче сигнатуры формата', async () => {
      const { token, meetingId } = await setUp();

      await uploadFile(
        token,
        meetingId,
        'Схема.png',
        PNG.subarray(0, 4),
      ).expect(415);

      expect(await fileNames(token, meetingId)).toEqual([]);
    });
  });

  describe('размер', () => {
    it('отклоняет пустой файл с 400', async () => {
      const { token, meetingId } = await setUp();
      await uploadFile(
        token,
        meetingId,
        'Заметки.txt',
        Buffer.from('a'),
      ).expect(201);

      const res = await uploadFile(
        token,
        meetingId,
        'Пустой.txt',
        Buffer.alloc(0),
      ).expect(400);

      expect(res.body).toMatchObject({ message: 'File is empty' });
      expect(await fileNames(token, meetingId)).toEqual(['Заметки.txt']);
    });

    it('отклоняет файл больше 1 ГБ с 413 до чтения тела', async () => {
      const { token, meetingId } = await setUp();
      const { upload, response } = startUpload(
        {
          Authorization: `Bearer ${token}`,
          'Content-Length': ONE_GIB + 1,
          'X-File-Name': encodeURIComponent('Большая запись.mp4'),
        },
        meetingId,
      );
      upload.write(SAMPLES[0][1].subarray(0, 10));

      const res = await response;
      upload.destroy();

      expect(res.status).toBe(413);
      expect(res.headers.connection).toBe('close');
      expect(JSON.parse(res.body)).toMatchObject({
        message: 'File is larger than 1 GiB',
      });
      expect(await fileNames(token, meetingId)).toEqual([]);
      expect(await entries(join(FILES_DIR, '.tmp'))).toEqual([]);
    });

    it('закрывает соединение при отказе без токена, не дожидаясь тела', async () => {
      const { meetingId } = await setUp();
      const { upload, response } = startUpload(
        {
          'Content-Length': ONE_GIB,
          'X-File-Name': encodeURIComponent('Запись.mp4'),
        },
        meetingId,
      );
      upload.write(SAMPLES[0][1].subarray(0, 10));

      const res = await response;
      upload.destroy();

      expect(res.status).toBe(401);
      expect(res.headers.connection).toBe('close');
    });
  });

  describe('обрыв', () => {
    it('после обрыва посреди тела не оставляет файла ни в списке, ни на диске', async () => {
      const { token, meetingId } = await setUp();
      await uploadFile(token, meetingId, 'Отчёт.pdf', PDF).expect(201);
      const data = withHead('%PDF-1.7\n', 256 * 1024);
      const { upload, response } = startUpload(
        {
          Authorization: `Bearer ${token}`,
          'Content-Length': data.length,
          'X-File-Name': encodeURIComponent('Оборванный.pdf'),
        },
        meetingId,
      );
      upload.write(data.subarray(0, data.length / 2));
      await delay(100);
      expect(await entries(join(FILES_DIR, '.tmp'))).toHaveLength(1);

      upload.destroy();
      await response;
      await waitUntilEmpty(join(FILES_DIR, '.tmp'));

      expect(await entries(join(FILES_DIR, '.tmp'))).toEqual([]);
      expect(await entries(join(FILES_DIR, meetingId))).toHaveLength(1);
      expect(await fileNames(token, meetingId)).toEqual(['Отчёт.pdf']);
    });
  });
});
