import { defineConfig, devices } from '@playwright/test';
import { dirname } from 'node:path';

import type { PluginOptions } from '@grafana/plugin-e2e';

const pluginE2eAuth = `${dirname(require.resolve('@grafana/plugin-e2e'))}/auth`;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig<PluginOptions>({
  expect: { timeout: 15000 },
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Configure projects for major browsers */
  projects: [
    // 1. Login to Grafana and store the cookie on disk for use in other tests.
    {
      name: 'auth',
      testDir: pluginE2eAuth,
      testMatch: [/.*\.js/],
      use: {
        user: {
          password: process.env.GRAFANA_ADMIN_PASSWORD ?? 'admin',
          role: 'Admin',
          // username and password passed via cli params
          // available as environment variables
          user: process.env.GRAFANA_ADMIN_USER ?? 'admin',
        },
      },
    },
    // 2. Run tests in Google Chrome. Every test will start authenticated as admin user.
    {
      dependencies: ['auth'],
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/admin.json' },
    },
  ],
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,
  testDir: './smoke-tests',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.GRAFANA_URL || 'http://localhost:3000',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    // Turn on when debugging local tests
    // video: {
    //   mode: 'on',
    // },
  },

  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
});
