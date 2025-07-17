import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 5,
  reporter: 'html',
  timeout: 30000,
  globalSetup: require.resolve('./test/e2e/global-setup.ts'),
  
  use: {
    baseURL: process.env.DIRECTUS_URL || 'http://localhost:8055',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  // Disable webServer in CI - GitHub Actions should handle the test environment
  webServer: process.env.CI ? undefined : {
    command: 'docker-compose up -d',
    url: 'http://localhost:8055',
    reuseExistingServer: true,
    timeout: 120000,
  },
});