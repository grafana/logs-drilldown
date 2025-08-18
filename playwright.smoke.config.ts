import { defineConfig } from '@playwright/test';

import type { PluginOptions } from '@grafana/plugin-e2e';

import { authProjectWithUser, baseConfig, chromiumProject } from './playwright.base.config';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig<PluginOptions>({
  ...baseConfig,
  testDir: './smoke-tests',
  /* Configure projects for major browsers */
  projects: [
    // 1. Login to Grafana and store the cookie on disk for use in other tests.
    authProjectWithUser,
    // 2. Run tests in Google Chrome. Every test will start authenticated as admin user.
    chromiumProject,
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    ...baseConfig.use,
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.GRAFANA_URL || 'http://localhost:3000',
  },
});
