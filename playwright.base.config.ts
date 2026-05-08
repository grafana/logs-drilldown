import { devices } from '@playwright/test';
import { dirname } from 'node:path';

const pluginE2eAuth = `${dirname(require.resolve('@grafana/plugin-e2e'))}/auth`;

/**
 * Base Playwright configuration with common settings
 * This can be extended by specific config files
 */
export const baseConfig = {
  expect: { timeout: 15000 },
  /* Fail the build if anyone leaves `test.only` in the source. Same in CI and local. */
  forbidOnly: true,
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Retry flaky tests once. Same in CI and local so behavior is identical. */
  retries: 1,
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry' as const,
    // Turn on when debugging local tests
    // video: {
    //   mode: 'on',
    // },
  },
  /* Fixed worker count, same in CI and local. */
  workers: 9,
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
    // storage state file is the username used to authenticate
    // user env variable or admin
    storageState: `playwright/.auth/${process.env.GRAFANA_ADMIN_USER ?? 'admin'}.json`,
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
