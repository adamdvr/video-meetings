import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test, type Download, type Page } from '@playwright/test';
import {
  createMeeting,
  registerUser,
  signIn,
  uploadFile,
  type Meeting,
  type MeetingFile,
} from './api';
import { localDate, TIME_ZONE } from './dates';

test.use({ locale: 'ru-RU', timezoneId: TIME_ZONE });

const sha256 = (data: Buffer) =>
  createHash('sha256').update(data).digest('hex');

const newMeeting = () => ({
  title: `Файлы ${randomUUID()}`,
  date: '2030-03-01T10:00:00.000Z',
  participants: [],
});

const fileUrl = (meetingId: string, fileId: string) =>
  `/meetings/${meetingId}/files/${fileId}`;

const fileRows = (page: Page) =>
  page.getByRole('list', { name: 'Файлы' }).getByRole('listitem');

async function downloadedBytes(download: Download) {
  return readFile(await download.path());
}

test.describe('Файлы встречи', () => {
  let accessToken: string;
  let meeting: Meeting;
  let emptyMeeting: Meeting;
  const contents = {
    report: randomBytes(300),
    slides: randomBytes(1536),
    recording: randomBytes(2.5 * 1024 * 1024),
  };
  let report: MeetingFile;
  let slides: MeetingFile;
  let recording: MeetingFile;
  let reportCopy: MeetingFile;

  test.beforeAll(async ({ request }) => {
    accessToken = await registerUser(request);
    meeting = await createMeeting(request, accessToken, newMeeting());
    emptyMeeting = await createMeeting(request, accessToken, newMeeting());

    const upload = (name: string, body: Buffer) =>
      uploadFile(request, accessToken, meeting.id, name, body);
    report = await upload('Отчёт за ноябрь.pdf', contents.report);
    slides = await upload('slides.pptx', contents.slides);
    recording = await upload('Запись звонка.mp4', contents.recording);
    reportCopy = await upload('Отчёт за ноябрь.pdf', randomBytes(300));
  });

  test.beforeEach(async ({ context }) => {
    await signIn(context, accessToken);
  });

  test('список: название, размер и дата, новые сверху', async ({ page }) => {
    await page.goto(`/meetings/${meeting.id}`);

    const rows = fileRows(page);
    await expect(rows).toHaveCount(4);
    const expected = [
      [reportCopy, /300\sБ/],
      [recording, /2,5\sМБ/],
      [slides, /1,5\sКБ/],
      [report, /300\sБ/],
    ] as const;
    for (const [index, [file, size]] of expected.entries()) {
      const row = rows.nth(index);
      await expect(row).toContainText(file.name);
      await expect(row).toContainText(size);
      await expect(row.locator('time')).toHaveText(localDate(file.createdAt));
      await expect(
        row.getByRole('link', { name: `Скачать ${file.name}` }),
      ).toHaveAttribute('href', fileUrl(meeting.id, file.id));
    }
  });

  test('во встрече без файлов — «Файлов пока нет»', async ({ page }) => {
    await page.goto(`/meetings/${meeting.id}`);
    await expect(fileRows(page)).toHaveCount(4);

    await page.goto(`/meetings/${emptyMeeting.id}`);
    await expect(
      page.getByRole('heading', { level: 1, name: emptyMeeting.title }),
    ).toBeVisible();
    await expect(page.getByText('Файлов пока нет')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Файлы' })).toHaveCount(0);
  });

  test('«Скачать» отдаёт файл под исходным названием', async ({ page }) => {
    await page.goto(`/meetings/${meeting.id}`);

    for (const [file, body] of [
      [report, contents.report],
      [recording, contents.recording],
    ] as const) {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page
          .getByRole('link', { name: `Скачать ${file.name}` })
          .last()
          .click(),
      ]);
      expect(download.suggestedFilename()).toBe(file.name);
      expect(sha256(await downloadedBytes(download))).toBe(sha256(body));
    }
  });

  test('чужой файл — «не найдено»', async ({ context, request }) => {
    const stranger = await registerUser(request);
    const foreignMeeting = await createMeeting(request, stranger, newMeeting());
    const foreign = await uploadFile(
      request,
      stranger,
      foreignMeeting.id,
      'secret.txt',
      Buffer.from('чужой секрет'),
    );

    const own = await context.request.get(fileUrl(meeting.id, slides.id));
    expect(own.status()).toBe(200);
    expect(sha256(await own.body())).toBe(sha256(contents.slides));

    for (const url of [
      fileUrl(foreignMeeting.id, foreign.id),
      fileUrl(meeting.id, foreign.id),
      fileUrl(emptyMeeting.id, slides.id),
      fileUrl(meeting.id, randomUUID()),
    ]) {
      const response = await context.request.get(url);
      expect(response.status(), url).toBe(404);
      expect(await response.text(), url).toBe('Файл не найден');
    }
  });

  test('без входа «Скачать» ведёт на /login', async ({ browser }) => {
    const anonymous = await browser.newPage();
    await anonymous.goto(fileUrl(meeting.id, report.id));

    await expect(anonymous).toHaveURL('/login');
    await anonymous.close();
  });
});
