import { defineConfig } from '@playwright/test';
import * as semver from 'semver/preload';

import type { PluginOptions } from '@grafana/plugin-e2e';

import { authProject, baseConfig, chromiumProjectWithPermissions } from './playwright.base.config';
import { GRAFANA_LATEST_SUPPORTED_VERSION } from './tests/config/grafana-versions-supported';
import { E2ESubPath } from './tests/fixtures/explore';

// Determine test directory based on the latest supported Grafana version
const getTestDir = () => {
  const grafanaVersion = process.env.GRAFANA_VERSION;

  // Local dev there is no GRAFANA_VERSION env variable, run all tests
  if (!grafanaVersion) {
    return './tests';
  }

  const latestSupported = GRAFANA_LATEST_SUPPORTED_VERSION;
  // Run full tests if grafanaVersion >= latestSupported, otherwise matrix tests
  if (latestSupported && semver.gte(grafanaVersion, latestSupported)) {
    return './tests';
  }

  return './tests/matrix-tests';
};

const testDir = getTestDir();

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig<PluginOptions>({
  ...baseConfig,
  testDir,
  /* Configure projects for major browsers */
  projects: [
    // 1. Login to Grafana and store the cookie on disk for use in other tests.
    authProject,
    // 2. Run tests in Google Chrome. Every test will start authenticated as admin user.
    chromiumProjectWithPermissions,
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    ...baseConfig.use,
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: `http://localhost:3001${E2ESubPath}`,
  },
});
