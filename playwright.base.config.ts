import { defineConfig, devices } from '@playwright/test';
import { dirname } from 'node:path';

import type { PluginOptions } from '@grafana/plugin-e2e';

const pluginE2eAuth = `${dirname(require.resolve('@grafana/plugin-e2e'))}/auth`;

/**
 * Base Playwright configuration with common settings
 * This can be extended by specific config files
 */
export const baseConfig = {
  expect: { timeout: 15000 },
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry' as const,
    // Turn on when debugging local tests
    // video: {
    //   mode: 'on',
    // },
  },
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
};

/**
 * Common auth project configuration
 */
export const authProject = {
  name: 'auth',
  testDir: pluginE2eAuth,
  testMatch: [/.*\.js/],
};

/**
 * Common chromium project configuration
 */
export const chromiumProject = {
  dependencies: ['auth'],
  name: 'chromium',
  use: {
    ...devices['Desktop Chrome'],
    storageState: 'playwright/.auth/admin.json',
  },
};

/**
 * Auth project with user credentials
 */
export const authProjectWithUser = {
  ...authProject,
  use: {
    user: {
      password: process.env.GRAFANA_ADMIN_PASSWORD ?? 'admin',
      role: 'Admin' as const,
      // username and password passed via cli params
      // available as environment variables
      user: process.env.GRAFANA_ADMIN_USER ?? 'admin',
    },
  },
};

/**
 * Chromium project with clipboard permissions
 */
export const chromiumProjectWithPermissions = {
  ...chromiumProject,
  use: {
    ...chromiumProject.use,
    permissions: ['clipboard-read', 'clipboard-write'],
  },
};
