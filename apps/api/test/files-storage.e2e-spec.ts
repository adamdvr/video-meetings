import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

const FILES_DIR = join(tmpdir(), `.video-meetings-e2e-${randomUUID()}`);

describe('Files storage (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  let meetingId: string;

  beforeAll(async () => {
    process.env.FILES_DIR = FILES_DIR;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `user-${randomUUID()}@example.com`,
        password: 'correct-horse-battery',
      })
      .expect(201);
    token = (registered.body as { accessToken: string }).accessToken;
    const meeting = await request(app.getHttpServer())
      .post('/meetings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Планёрка',
        date: '2030-01-15T10:00:00.000Z',
        participants: [],
      })
      .expect(201);
    meetingId = (meeting.body as { id: string }).id;
  });

  afterAll(async () => {
    await app.close();
    await rm(FILES_DIR, { recursive: true, force: true });
  });

  async function upload(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(`/meetings/${meetingId}/files`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/octet-stream')
      .set('X-File-Name', 'file.pdf')
      .send(Buffer.from('%PDF-1.7\nbody'))
      .expect(201);
    return (res.body as { id: string }).id;
  }

  it('отдаёт файл из каталога внутри скрытой папки', async () => {
    const fileId = await upload();

    await request(app.getHttpServer())
      .get(`/meetings/${meetingId}/files/${fileId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('отвечает JSON 404 без пути на диске, если файла нет на диске', async () => {
    const fileId = await upload();
    await rm(join(FILES_DIR, meetingId, fileId));

    const res = await request(app.getHttpServer())
      .get(`/meetings/${meetingId}/files/${fileId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404)
      .expect('Content-Type', /application\/json/);

    expect(res.body).toEqual({
      statusCode: 404,
      error: 'Not Found',
      message: 'File not found',
    });
    expect(res.text).not.toContain(FILES_DIR);
  });
});
