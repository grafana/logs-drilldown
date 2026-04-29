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
  /* Per-test timeout. Default is 30s, but with `workers: 4` tests share a
   * single Grafana instance and queries are slightly serialized, so long
   * tests with many UI interactions can exceed 30s under parallel load.
   * 60s gives a comfortable margin without masking real hangs. */
  timeout: 60_000,
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
  /* Parallel workers. The static-data Loki snapshot makes query outcomes
   * deterministic, so tests can run in parallel against a single Grafana +
   * Loki stack. Empirically 4 is the sweet spot: more workers (e.g. 10)
   * overwhelm Grafana's query proxy with concurrent panel requests and
   * cause spurious "loading indicator" timeouts. metrics-drilldown uses
   * the same value for the same reason. */
  workers: 4,
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
