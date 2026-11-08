import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  createMeeting,
  registerUser,
  signIn,
  uploadFile,
  WEB_URL,
  type Meeting,
} from './api';
import { TIME_ZONE } from './dates';

test.use({ locale: 'ru-RU', timezoneId: TIME_ZONE });

const sha256 = (data: Buffer) =>
  createHash('sha256').update(data).digest('hex');

const newMeeting = () => ({
  title: `Загрузка ${randomUUID()}`,
  date: '2030-03-01T10:00:00.000Z',
  participants: [],
});

const fileRows = (page: Page) =>
  page.getByRole('list', { name: 'Файлы' }).getByRole('listitem');

const chooseFilesButton = (page: Page) =>
  page.getByRole('button', { name: 'Выбрать файлы' });

async function chooseFiles(page: Page, files: string[]) {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    chooseFilesButton(page).click(),
  ]);
  expect(chooser.isMultiple()).toBe(true);
  await chooser.setFiles(files);
}

async function dropFiles(page: Page, target: Locator, files: string[]) {
  const box = await target.boundingBox();
  if (!box) throw new Error('Область загрузки не видна');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const data = { items: [], files, dragOperationsMask: 1 };
  const cdp = await page.context().newCDPSession(page);
  for (const type of ['dragEnter', 'dragOver', 'drop'] as const) {
    await cdp.send('Input.dispatchDragEvent', { type, x, y, data });
  }
  await cdp.detach();
}

function postChunked(path: string, accessToken: string) {
  return new Promise<number>((resolve, reject) => {
    const outgoing = httpRequest(
      `${WEB_URL}${path}`,
      {
        method: 'POST',
        headers: {
          Cookie: `access_token=${accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Transfer-Encoding': 'chunked',
          'X-File-Name': 'chunked.txt',
        },
      },
      (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      },
    );
    outgoing.on('error', reject);
    outgoing.end('данные');
  });
}

async function markPage(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { uploadMarker: string }).uploadMarker = 'same';
  });
}

async function expectSamePage(page: Page) {
  expect(
    await page.evaluate(
      () => (window as unknown as { uploadMarker?: string }).uploadMarker,
    ),
  ).toBe('same');
}

async function slowDownUploads(page: Page, bytesPerSecond: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: bytesPerSecond,
  });
  return async () => {
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    await cdp.detach();
  };
}

test.describe('Загрузка файлов встречи', () => {
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

  test('«Выбрать файлы» во встрече без файлов: файл появляется в списке без перезагрузки', async ({
    page,
    request,
  }, testInfo) => {
    const meeting = await createMeeting(request, accessToken, newMeeting());
    await openMeeting(page, meeting);
    await expect(page.getByText('Файлов пока нет')).toBeVisible();
    await markPage(page);

    const name = 'Протокол встречи.txt';
    const path = testInfo.outputPath(name);
    await writeFile(path, 'Итоги: всё по плану\n');
    await chooseFiles(page, [path]);

    await expect(fileRows(page)).toHaveCount(1);
    await expect(fileRows(page).first()).toContainText(name);
    await expect(page.getByText('Файлов пока нет')).toHaveCount(0);
    await expectSamePage(page);
  });

  test('новый файл появляется в начале списка', async ({
    page,
    request,
  }, testInfo) => {
    const meeting = await createMeeting(request, accessToken, newMeeting());
    await uploadFile(
      request,
      accessToken,
      meeting.id,
      'old.txt',
      Buffer.from('старый'),
    );
    await openMeeting(page, meeting);
    await expect(fileRows(page)).toHaveCount(1);
    await markPage(page);

    const path = testInfo.outputPath('new.txt');
    await writeFile(path, 'новый');
    await chooseFiles(page, [path]);

    await expect(fileRows(page)).toHaveCount(2);
    await expect(fileRows(page).nth(0)).toContainText('new.txt');
    await expect(fileRows(page).nth(1)).toContainText('old.txt');
    await expectSamePage(page);
  });

  test('перетаскивание нескольких файлов в область загрузки', async ({
    page,
    request,
  }, testInfo) => {
    const meeting = await createMeeting(request, accessToken, newMeeting());
    await openMeeting(page, meeting);
    await markPage(page);

    const names = ['Перетащенный 1.txt', 'Перетащенный 2.txt'];
    const paths = names.map((name) => testInfo.outputPath(name));
    for (const [index, path] of paths.entries()) {
      await writeFile(path, `файл ${index + 1}`);
    }
    await dropFiles(page, page.getByTestId('file-drop-zone'), paths);

    await expect(fileRows(page)).toHaveCount(2);
    for (const name of names) {
      await expect(
        page.getByRole('list', { name: 'Файлы' }).getByText(name),
      ).toBeVisible();
    }
    await expectSamePage(page);
  });

  test('у каждого из нескольких файлов свой прогресс в процентах', async ({
    page,
    request,
  }, testInfo) => {
    const meeting = await createMeeting(request, accessToken, newMeeting());
    await openMeeting(page, meeting);

    const names = ['Запись 1.mp4', 'Запись 2.mp4'];
    const paths = names.map((name) => testInfo.outputPath(name));
    for (const path of paths) await writeFile(path, randomBytes(1024 * 1024));

    const restore = await slowDownUploads(page, 256 * 1024);
    await chooseFiles(page, paths);

    for (const name of names) {
      const progress = page.getByRole('progressbar', {
        name: `Загрузка ${name}`,
      });
      await expect(progress).toBeVisible();
      await expect(progress).toHaveText(/\d+\s?%/);
    }
    await expect
      .poll(async () =>
        Number(
          await page
            .getByRole('progressbar', { name: `Загрузка ${names[0]}` })
            .getAttribute('aria-valuenow'),
        ),
      )
      .toBeGreaterThan(0);

    await restore();
    await expect(fileRows(page)).toHaveCount(2);
    await expect(page.getByRole('progressbar')).toHaveCount(0);
  });

  test('сбой одного файла не останавливает остальные', async ({
    page,
    request,
  }, testInfo) => {
    const meeting = await createMeeting(request, accessToken, newMeeting());
    await openMeeting(page, meeting);

    await page.route(`**/meetings/${meeting.id}/files`, (route) =>
      route.request().headers()['x-file-name'] ===
      encodeURIComponent('broken.txt')
        ? route.fulfill({ status: 500, body: '{}' })
        : route.continue(),
    );
    const paths = ['broken.txt', 'fine.txt'].map((name) =>
      testInfo.outputPath(name),
    );
    for (const path of paths) await writeFile(path, 'данные');
    await chooseFiles(page, paths);

    await expect(fileRows(page)).toHaveCount(1);
    await expect(fileRows(page).first()).toContainText('fine.txt');
    await expect(
      page
        .getByRole('list', { name: 'Загрузки' })
        .getByRole('listitem')
        .filter({ hasText: 'broken.txt' }),
    ).toContainText('Не удалось загрузить');
    await page.unrouteAll();
  });

  test('скачанный файл совпадает с загруженным: 500 КБ, 5 МБ и 50 МБ', async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(120_000);
    const meeting = await createMeeting(request, accessToken, newMeeting());
    await openMeeting(page, meeting);

    const files = [
      ['500 КБ.bin', 500 * 1024],
      ['5 МБ.bin', 5 * 1024 * 1024],
      ['50 МБ.bin', 50 * 1024 * 1024],
    ] as const;
    const hashes = new Map<string, string>();
    const paths: string[] = [];
    for (const [name, size] of files) {
      const body = randomBytes(size);
      const path = testInfo.outputPath(name);
      await writeFile(path, body);
      hashes.set(name, sha256(body));
      paths.push(path);
    }
    await chooseFiles(page, paths);
    await expect(fileRows(page)).toHaveCount(files.length, {
      timeout: 60_000,
    });

    for (const [name] of files) {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('link', { name: `Скачать ${name}` }).click(),
      ]);
      expect(download.suggestedFilename()).toBe(name);
      expect(sha256(await readFile(await download.path())), name).toBe(
        hashes.get(name),
      );
    }
  });

  test('Route Handler загрузки: без входа 401, чужая встреча 404, чужой Origin 403, без длины 411', async ({
    browser,
    context,
    request,
  }) => {
    const meeting = await createMeeting(request, accessToken, newMeeting());
    const stranger = await registerUser(request);
    const foreign = await createMeeting(request, stranger, newMeeting());
    const upload = (
      client: typeof request,
      meetingId: string,
      name: string,
      headers: Record<string, string> = {},
    ) =>
      client.post(`/meetings/${meetingId}/files`, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-File-Name': encodeURIComponent(name),
          ...headers,
        },
        data: Buffer.from('данные'),
      });

    const own = await upload(context.request, meeting.id, 'Свой файл.txt', {
      Origin: WEB_URL,
    });
    expect(own.status()).toBe(201);
    expect(await own.json()).toMatchObject({ name: 'Свой файл.txt', size: 12 });

    const crossSite = await upload(context.request, meeting.id, 'x.txt', {
      Origin: 'https://evil.example',
    });
    expect(crossSite.status()).toBe(403);

    expect(
      await postChunked(`/meetings/${meeting.id}/files`, accessToken),
    ).toBe(411);

    const foreignUpload = await upload(context.request, foreign.id, 'x.txt');
    expect(foreignUpload.status()).toBe(404);

    const anonymous = await browser.newContext();
    const unauthorized = await upload(anonymous.request, meeting.id, 'x.txt');
    expect(unauthorized.status()).toBe(401);
    await anonymous.close();
  });
});
