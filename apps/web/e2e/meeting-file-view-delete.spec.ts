import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page, type Response } from '@playwright/test';
import {
  createMeeting,
  listFiles,
  registerUser,
  signIn,
  uploadFile,
  type Meeting,
  type MeetingFile,
} from './api';
import { fileBytes, pngImage, wavBytes } from './file-bytes';
import { fileRows } from './upload';

const newMeeting = () => ({
  title: `Просмотр ${randomUUID()}`,
  date: '2030-03-01T10:00:00.000Z',
  participants: [],
});

const fileUrl = (meetingId: string, fileId: string) =>
  `/meetings/${meetingId}/files/${fileId}`;

const viewUrl = (meetingId: string, fileId: string) =>
  `${fileUrl(meetingId, fileId)}/view`;

const viewButton = (page: Page, name: string) =>
  page.getByRole('button', { name: `Смотреть ${name}` });

async function slowDownDownloads(page: Page, bytesPerSecond: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: bytesPerSecond,
    uploadThroughput: -1,
  });
}

test.describe('Просмотр и удаление файлов', () => {
  let accessToken: string;
  let meeting: Meeting;
  let clip: Buffer;
  const files: Record<string, MeetingFile> = {};

  test.beforeAll(async ({ request }) => {
    accessToken = await registerUser(request);
    meeting = await createMeeting(request, accessToken, newMeeting());
    clip = await readFile(path.join(__dirname, 'fixtures', 'clip.webm'));

    const upload = async (name: string, body: Buffer) => {
      files[name] = await uploadFile(
        request,
        accessToken,
        meeting.id,
        name,
        body,
      );
    };
    await upload('Запись.webm', clip);
    await upload('Голос.wav', wavBytes(2));
    await upload('Схема.png', pngImage(64, 48));
    await upload('Отчёт.pdf', fileBytes('pdf', 300));
    await upload('Камера.mov', fileBytes('mov', 4096));
    await upload('Договор.docx', fileBytes('pptx', 300));
    await upload('Слайды.pptx', fileBytes('pptx', 300));
    await upload('Бюджет.xlsx', fileBytes('pptx', 300));
    await upload('Заметки.txt', Buffer.from('просто текст'));
  });

  test.beforeEach(async ({ context }) => {
    await signIn(context, accessToken);
  });

  test('«Смотреть» только у видео, аудио, PDF и изображений', async ({
    page,
  }) => {
    await page.goto(`/meetings/${meeting.id}`);
    await expect(fileRows(page)).toHaveCount(9);

    for (const name of [
      'Запись.webm',
      'Голос.wav',
      'Схема.png',
      'Камера.mov',
    ]) {
      await expect(viewButton(page, name)).toBeVisible();
    }
    await expect(
      page.getByRole('link', { name: 'Смотреть Отчёт.pdf' }),
    ).toHaveAttribute('href', viewUrl(meeting.id, files['Отчёт.pdf'].id));
    for (const name of [
      'Договор.docx',
      'Слайды.pptx',
      'Бюджет.xlsx',
      'Заметки.txt',
    ]) {
      const row = fileRows(page).filter({ hasText: name });
      await expect(
        row.getByRole('link', { name: `Скачать ${name}` }),
      ).toBeVisible();
      await expect(row.getByText('Смотреть')).toHaveCount(0);
      await expect(
        row.getByRole('button', { name: `Смотреть ${name}` }),
      ).toHaveCount(0);
      await expect(
        row.getByRole('link', { name: `Смотреть ${name}` }),
      ).toHaveCount(0);
    }
  });

  test('видео, аудио и изображение открываются без скачивания', async ({
    page,
  }) => {
    const downloads: string[] = [];
    page.on('download', (download) => downloads.push(download.url()));
    await page.goto(`/meetings/${meeting.id}`);

    const cases = [
      ['Запись.webm', 'video'],
      ['Голос.wav', 'audio'],
      ['Схема.png', 'img'],
    ] as const;
    for (const [name, tag] of cases) {
      await viewButton(page, name).click();
      const dialog = page.getByRole('dialog', { name });
      await expect(dialog).toBeVisible();
      const media = dialog.locator(tag);
      await expect
        .poll(() =>
          media.evaluate(
            (element: HTMLImageElement | HTMLMediaElement) =>
              new URL(element.src).pathname,
          ),
        )
        .toBe(viewUrl(meeting.id, files[name].id));
      if (tag === 'img') {
        await expect
          .poll(() =>
            media.evaluate((image: HTMLImageElement) => image.naturalWidth),
          )
          .toBe(64);
      } else {
        await expect
          .poll(() =>
            media.evaluate((element: HTMLMediaElement) => element.duration),
          )
          .toBeGreaterThan(1);
      }
      await expect(dialog.getByText('Браузер не может открыть')).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    }
    expect(downloads).toEqual([]);
  });

  test('просмотр отдаётся inline, а PDF открывается в новой вкладке', async ({
    page,
    context,
  }) => {
    await page.goto(`/meetings/${meeting.id}`);
    await expect(
      page.getByRole('link', { name: 'Смотреть Отчёт.pdf' }),
    ).toHaveAttribute('target', '_blank');

    for (const [name, type] of [
      ['Отчёт.pdf', 'application/pdf'],
      ['Запись.webm', 'video/webm'],
      ['Схема.png', 'image/png'],
    ]) {
      const response = await context.request.get(
        viewUrl(meeting.id, files[name].id),
      );
      expect(response.status(), name).toBe(200);
      expect(response.headers()['content-type'], name).toBe(type);
      expect(response.headers()['content-disposition'], name).toMatch(
        /^inline;/,
      );
      expect(response.headers()['x-content-type-options'], name).toBe(
        'nosniff',
      );
    }

    const range = await context.request.get(
      viewUrl(meeting.id, files['Запись.webm'].id),
      { headers: { Range: 'bytes=1000-1999' } },
    );
    expect(range.status()).toBe(206);
    expect(range.headers()['content-range']).toBe(
      `bytes 1000-1999/${clip.length}`,
    );
    expect((await range.body()).equals(clip.subarray(1000, 2000))).toBe(true);
  });

  test('видео перематывается в середину до окончания загрузки', async ({
    page,
  }) => {
    const id = files['Запись.webm'].id;
    const viewResponses: Response[] = [];
    page.on('response', (response) => {
      if (new URL(response.url()).pathname === viewUrl(meeting.id, id)) {
        viewResponses.push(response);
      }
    });
    await page.goto(`/meetings/${meeting.id}`);
    await slowDownDownloads(page, 32 * 1024);

    await viewButton(page, 'Запись.webm').click();
    const video = page
      .getByRole('dialog', { name: 'Запись.webm' })
      .locator('video');
    await expect
      .poll(
        () =>
          video.evaluate((element: HTMLVideoElement) => ({
            duration: element.duration,
            idle: element.networkState === element.NETWORK_IDLE,
          })),
        { timeout: 20_000 },
      )
      .toEqual({ duration: expect.any(Number), idle: true });

    const state = await video.evaluate(async (element: HTMLVideoElement) => {
      const middle = element.duration / 2;
      const middleBuffered = Array.from(
        { length: element.buffered.length },
        (_, index) => [
          element.buffered.start(index),
          element.buffered.end(index),
        ],
      ).some(([start, end]) => start <= middle && middle < end);
      const seeked = new Promise((resolve) =>
        element.addEventListener('seeked', resolve, { once: true }),
      );
      element.currentTime = middle;
      await seeked;
      return { middle, middleBuffered, currentTime: element.currentTime };
    });
    expect(state.middle).toBeGreaterThan(15);
    expect(state.middleBuffered).toBe(false);
    expect(state.currentTime).toBeCloseTo(state.middle, 0);

    const ranged = await Promise.all(
      viewResponses.map(async (response) => ({
        status: response.status(),
        range: (await response.request().allHeaders())['range'] ?? '',
      })),
    );
    const middleRequest = ranged.find(({ range }) => {
      const start = Number(/^bytes=(\d+)-/.exec(range)?.[1] ?? 0);
      return start > clip.length * 0.25 && start < clip.length * 0.9;
    });
    expect(middleRequest, JSON.stringify(ranged)).toBeDefined();
    expect(middleRequest?.status).toBe(206);
  });

  test('файл, который браузер не открыл, предлагает «Скачать»', async ({
    page,
  }) => {
    const mov = files['Камера.mov'];
    await page.goto(`/meetings/${meeting.id}`);

    await viewButton(page, mov.name).click();
    const dialog = page.getByRole('dialog', { name: mov.name });
    await expect(dialog.getByText('Браузер не может открыть')).toBeVisible();
    const download = dialog.getByRole('link', { name: 'Скачать' });
    await expect(download).toHaveAttribute('href', fileUrl(meeting.id, mov.id));

    const [file] = await Promise.all([
      page.waitForEvent('download'),
      download.click(),
    ]);
    expect(file.suggestedFilename()).toBe(mov.name);
  });

  test('«Удалить»: отказ оставляет файл, согласие удаляет его', async ({
    page,
    context,
    request,
  }) => {
    const target = await uploadFile(
      request,
      accessToken,
      meeting.id,
      'Удаляемый.png',
      pngImage(8, 8),
    );
    await page.goto(`/meetings/${meeting.id}`);
    const row = fileRows(page).filter({ hasText: target.name });
    await expect(row).toHaveCount(1);

    await page.getByRole('button', { name: `Удалить ${target.name}` }).click();
    let dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText(target.name);
    await dialog.getByRole('button', { name: 'Отмена' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(row).toHaveCount(1);
    expect(
      (await listFiles(request, accessToken, meeting.id)).map(({ id }) => id),
    ).toContain(target.id);

    await page.getByRole('button', { name: `Удалить ${target.name}` }).click();
    dialog = page.getByRole('alertdialog');
    await dialog.getByRole('button', { name: 'Удалить' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(row).toHaveCount(0);
    await expect(fileRows(page)).not.toHaveCount(0);

    expect(
      (await listFiles(request, accessToken, meeting.id)).map(({ id }) => id),
    ).not.toContain(target.id);
    for (const url of [
      fileUrl(meeting.id, target.id),
      viewUrl(meeting.id, target.id),
    ]) {
      const response = await context.request.get(url);
      expect(response.status(), url).toBe(404);
      expect(await response.text(), url).toBe('Файл не найден');
    }
  });

  test('«Удалить» с отвергнутой сессией ведёт на /login', async ({
    page,
    context,
    request,
  }) => {
    const target = await uploadFile(
      request,
      accessToken,
      meeting.id,
      'Сессия.png',
      pngImage(8, 8),
    );
    await page.goto(`/meetings/${meeting.id}`);
    await expect(
      page.getByRole('button', { name: `Удалить ${target.name}` }),
    ).toBeVisible();

    const [header, payload] = accessToken.split('.');
    await context.clearCookies();
    await signIn(context, `${header}.${payload}.forged-signature`);

    await page.getByRole('button', { name: `Удалить ${target.name}` }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Удалить' })
      .click();

    await expect(page).toHaveURL('/login');
    expect(
      (await listFiles(request, accessToken, meeting.id)).map(({ id }) => id),
    ).toContain(target.id);
  });

  test('без входа просмотр ведёт на /login', async ({ browser }) => {
    const anonymous = await browser.newPage();
    await anonymous.goto(viewUrl(meeting.id, files['Схема.png'].id));

    await expect(anonymous).toHaveURL('/login');
    await anonymous.close();
  });
});
