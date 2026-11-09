import { randomUUID } from 'node:crypto';
import { open, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  createMeeting,
  listFiles,
  registerUser,
  signIn,
  type Meeting,
} from './api';
import { fileBytes } from './file-bytes';
import {
  chooseFiles,
  fileRows,
  slowDownUploads,
  uploadProgress,
  uploadRow,
} from './upload';

const GIB = 1024 ** 3;

const newMeeting = () => ({
  title: `Отказы загрузки ${randomUUID()}`,
  date: '2030-03-01T10:00:00.000Z',
  participants: [],
});

async function writeSparseFile(path: string, size: number) {
  const file = await open(path, 'w');
  await file.truncate(size);
  await file.close();
}

function recordUploads(page: Page, meetingId: string) {
  const names: string[] = [];
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      request.url().endsWith(`/meetings/${meetingId}/files`)
    ) {
      names.push(decodeURIComponent(request.headers()['x-file-name'] ?? ''));
    }
  });
  return names;
}

test.describe('Отказы, отмена и обрыв загрузки', () => {
  let accessToken: string;

  test.beforeAll(async ({ request }) => {
    accessToken = await registerUser(request);
  });

  test.beforeEach(async ({ context }) => {
    await signIn(context, accessToken);
  });

  const openMeeting = async (page: Page, meeting: Meeting) => {
    await page.goto(`/meetings/${meeting.id}`);
    await expect(
      page.getByRole('heading', { level: 1, name: meeting.title }),
    ).toBeVisible();
  };

  test('недопустимый формат, пустой и больше 1 ГБ отклоняются до загрузки, соседний файл загружается', async ({
    page,
    request,
  }, testInfo) => {
    const meeting = await createMeeting(request, accessToken, newMeeting());
    await openMeeting(page, meeting);
    const sent = recordUploads(page, meeting.id);

    const archive = testInfo.outputPath('Архив.zip');
    const empty = testInfo.outputPath('Пустой.txt');
    const huge = testInfo.outputPath('Большой.mp4');
    const fine = testInfo.outputPath('Нормальный.txt');
    await writeFile(archive, Buffer.from('PK\x03\x04архив', 'latin1'));
    await writeFile(empty, '');
    await writeSparseFile(huge, GIB + 1);
    await writeFile(fine, 'данные');
    await chooseFiles(page, [archive, empty, huge, fine]);

    await expect(fileRows(page)).toHaveCount(1);
    await expect(fileRows(page).first()).toContainText('Нормальный.txt');
    await expect(uploadRow(page, 'Архив.zip')).toContainText(
      'Формат не поддерживается',
    );
    await expect(uploadRow(page, 'Пустой.txt')).toContainText('Файл пустой');
    await expect(uploadRow(page, 'Большой.mp4')).toContainText(
      'Файл больше 1 ГБ',
    );
    expect(sent).toEqual(['Нормальный.txt']);
  });

  test('отказ api: у файла причина, в списке его нет', async ({
    page,
    request,
  }, testInfo) => {
    const meeting = await createMeeting(request, accessToken, newMeeting());
    await openMeeting(page, meeting);

    const path = testInfo.outputPath('Скриншот.pdf');
    await writeFile(path, fileBytes('png', 1024));
    await chooseFiles(page, [path]);

    await expect(uploadRow(page, 'Скриншот.pdf')).toContainText(
      'Содержимое не соответствует формату',
    );
    await expect(page.getByText('Файлов пока нет')).toBeVisible();
    expect(await listFiles(request, accessToken, meeting.id)).toEqual([]);
  });

  test('«Отменить» прерывает загрузку, остальные завершаются', async ({
    page,
    request,
  }, testInfo) => {
    const meeting = await createMeeting(request, accessToken, newMeeting());
    await openMeeting(page, meeting);

    const cancelled = 'Отменяемый.mp4';
    const kept = 'Остающийся.mp4';
    const paths = [cancelled, kept].map((name) => testInfo.outputPath(name));
    for (const path of paths)
      await writeFile(path, fileBytes('mp4', 1024 * 1024));

    const restore = await slowDownUploads(page, 256 * 1024);
    await chooseFiles(page, paths);
    await uploadProgress(page, cancelled);

    await page
      .getByRole('button', { name: `Отменить загрузку ${cancelled}` })
      .click();
    await expect(uploadRow(page, cancelled)).toContainText('Загрузка отменена');
    await expect(
      page.getByRole('progressbar', { name: `Загрузка ${cancelled}` }),
    ).toHaveCount(0);

    await restore();
    await expect(fileRows(page)).toHaveCount(1);
    await expect(fileRows(page).first()).toContainText(kept);
    expect(
      (await listFiles(request, accessToken, meeting.id)).map(
        (file) => file.name,
      ),
    ).toEqual([kept]);
  });

  test('обрыв связи: у файла ошибка, в списке его нет, повторная загрузка проходит', async ({
    page,
    request,
  }, testInfo) => {
    const meeting = await createMeeting(request, accessToken, newMeeting());
    await openMeeting(page, meeting);

    const name = 'Обрыв.mp4';
    const path = testInfo.outputPath(name);
    await writeFile(path, fileBytes('mp4', 1024 * 1024));

    let attempts = 0;
    await page.route(`**/meetings/${meeting.id}/files`, (route) =>
      ++attempts === 1 ? route.abort('internetdisconnected') : route.continue(),
    );
    await chooseFiles(page, [path]);

    await expect(uploadRow(page, name)).toContainText('Связь прервалась');
    await expect(page.getByText('Файлов пока нет')).toBeVisible();
    expect(await listFiles(request, accessToken, meeting.id)).toEqual([]);

    await page
      .getByRole('button', { name: `Повторить загрузку ${name}` })
      .click();
    await expect(fileRows(page)).toHaveCount(1);
    await expect(fileRows(page).first()).toContainText(name);
    expect(attempts).toBe(2);
  });

  test('обрыв после отправки тела: «Повторить» нет, сохранённый api файл появляется в списке', async ({
    page,
    request,
  }, testInfo) => {
    const meeting = await createMeeting(request, accessToken, newMeeting());
    await openMeeting(page, meeting);

    const name = 'Сохранён без ответа.txt';
    const path = testInfo.outputPath(name);
    await writeFile(path, 'данные');
    const cdp = await page.context().newCDPSession(page);
    cdp.on('Fetch.requestPaused', ({ requestId }) =>
      cdp.send('Fetch.failRequest', {
        requestId,
        errorReason: 'ConnectionReset',
      }),
    );
    await cdp.send('Fetch.enable', {
      patterns: [
        {
          urlPattern: `*/meetings/${meeting.id}/files`,
          requestStage: 'Response',
        },
      ],
    });
    await chooseFiles(page, [path]);

    await expect(uploadRow(page, name)).toContainText(
      'Связь прервалась после отправки',
    );
    await expect(
      page.getByRole('button', { name: `Повторить загрузку ${name}` }),
    ).toHaveCount(0);
    await expect(fileRows(page)).toHaveCount(1);
    await expect(fileRows(page).first()).toContainText(name);
    await cdp.detach();
  });

  test('пробел в конце имени не мешает проверке формата, как в api', async ({
    page,
    request,
  }, testInfo) => {
    const meeting = await createMeeting(request, accessToken, newMeeting());
    await openMeeting(page, meeting);

    const path = testInfo.outputPath('Заметки.txt ');
    await writeFile(path, 'данные');
    await chooseFiles(page, [path]);

    await expect(fileRows(page)).toHaveCount(1);
    await expect(fileRows(page).first()).toContainText('Заметки.txt');
    expect(
      (await listFiles(request, accessToken, meeting.id)).map(
        (file) => file.name,
      ),
    ).toEqual(['Заметки.txt']);
  });
});
