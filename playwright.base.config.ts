import { defineConfig, devices } from '@playwright/test';
import { dirname } from 'node:path';

import type { PluginOptions } from '@grafana/plugin-e2e';

const pluginE2eAuth = `${dirname(require.resolve('@grafana/plugin-e2e'))}/auth`;

/**
 * Base Playwright configuration with common settings
 * This can be extended by specific config files
 */
export const baseConfig = {
  /* Default expect timeout. Bumped from 15s to 30s because under parallel
   * E2E load (multiple workers sharing a single Grafana + Loki stack)
   * queries and scene rendering can take noticeably longer than in
   * isolation. Individual assertions can still pass an explicit `timeout`
   * override when they need to wait longer or shorter. */
  expect: { timeout: 30000 },
  /* Per-test timeout. With multiple workers, tests share a single Grafana
   * instance and queries are slightly serialized. Long tests with many UI
   * interactions and tab navigations can accumulate sequential waits well
   * past the Playwright default of 30s. 180s gives plenty of headroom for
   * the longest tests (e.g. cluster breakdown tests) without masking real
   * hangs — Grafana shouldn't ever take >2 minutes to respond to a query
   * against the static-data Loki snapshot. */
  timeout: 180_000,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Always retry once. With multiple workers driving a single Grafana +
   * Loki stack, individual queries occasionally hang on the backend
   * (request never returns) even though the test logic is correct — most
   * commonly on field/label *value* breakdown queries that do an
   * unaggregated `count_over_time(... | json | logfmt ...)` over the full
   * snapshot window. A single retry reliably masks these one-off backend
   * hangs without hiding real test logic failures (those still fail twice).
   */
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
  /* Parallel workers. The static-data Loki snapshot makes query outcomes
   * deterministic, so tests can run in parallel against a single Grafana +
   * Loki stack. Empirically 4 is the sweet spot: more workers (e.g. 10)
   * overwhelm Grafana's query proxy with concurrent panel requests and
   * cause spurious "loading indicator" timeouts. metrics-drilldown uses
   * the same value for the same reason. */
  workers: 2,
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
