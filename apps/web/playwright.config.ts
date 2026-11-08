import { defineConfig, devices } from '@playwright/test';
import { API_URL, WEB_URL } from './e2e/api';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev -w api',
      cwd: '../..',
      url: `${API_URL}/meetings`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -w web',
      cwd: '../..',
      url: `${WEB_URL}/login`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
