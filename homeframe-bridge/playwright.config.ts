import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  timeout: 60000,
  outputDir: '../qa-artifacts/original-ui/browser',
  use: {
    baseURL: process.env.STUDIO_TEST_URL ?? 'http://127.0.0.1:5177',
    storageState: process.env.STUDIO_TEST_STORAGE,
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 980 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
});
