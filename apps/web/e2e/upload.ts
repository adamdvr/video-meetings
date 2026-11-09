import { expect, type Page } from '@playwright/test';

export const fileRows = (page: Page) =>
  page.getByRole('list', { name: 'Файлы' }).getByRole('listitem');

export const uploadRow = (page: Page, name: string) =>
  page
    .getByRole('list', { name: 'Загрузки' })
    .getByRole('listitem')
    .filter({ hasText: name });

export async function chooseFiles(page: Page, files: string[]) {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Выбрать файлы' }).click(),
  ]);
  expect(chooser.isMultiple()).toBe(true);
  await chooser.setFiles(files);
}

export async function slowDownUploads(page: Page, bytesPerSecond: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  const throttle = (uploadThroughput: number) =>
    cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput,
    });
  await throttle(bytesPerSecond);
  return async () => {
    await throttle(-1);
    await cdp.detach();
  };
}

export const uploadProgress = (page: Page, name: string) =>
  expect
    .poll(async () =>
      Number(
        await page
          .getByRole('progressbar', { name: `Загрузка ${name}` })
          .getAttribute('aria-valuenow'),
      ),
    )
    .toBeGreaterThan(0);
