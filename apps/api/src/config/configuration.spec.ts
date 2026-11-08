import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from './configuration.js';

describe('getConfig', () => {
  const original = process.env.FILES_DIR;

  afterEach(() => {
    process.env.FILES_DIR = original;
  });

  it('берёт каталог файлов по умолчанию, если FILES_DIR пустой', () => {
    process.env.FILES_DIR = '';

    expect(getConfig().filesDir).toBe(
      resolve(fileURLToPath(new URL('../../storage', import.meta.url))),
    );
  });
});
