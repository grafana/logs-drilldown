import { test } from '@grafana/plugin-e2e';
import semver from 'semver';

export const GRAFANA_LATEST_SUPPORTED_VERSION = '13.0.0';
/**
 * Check if the current Grafana version is the latest supported version or newer.
 * Used to skip tests that should only run on the latest Grafana version.
 */
export const isLatestGrafana = (grafanaVersion: string): boolean => {
  return semver.gte(grafanaVersion, GRAFANA_LATEST_SUPPORTED_VERSION);
};

/**
 * Use as a standalone beforeEach or call first inside your own beforeEach.
 * Skips the test when Grafana version is below GRAFANA_LATEST_SUPPORTED_VERSION.
 *
 * @example
 * // Only version check:
 * test.beforeEach(skipUnlessLatestGrafana);
 *
 * @example
 * // With other setup:
 * test.beforeEach(async ({ page, grafanaVersion }, testInfo) => {
 *   skipUnlessLatestGrafana({ grafanaVersion });
 *   await page.evaluate(() => window.localStorage.clear());
 *   // ...
 * });
 */
export const skipUnlessLatestGrafana = ({ grafanaVersion }: { grafanaVersion: string }): void => {
  test.skip(!isLatestGrafana(grafanaVersion), `Skipping: requires Grafana >= ${GRAFANA_LATEST_SUPPORTED_VERSION}`);
};

/** Minimum Grafana version for default labels (service selection). Requires kubernetesLogsDrilldown feature flag. */
const DEFAULT_LABELS_MIN_VERSION = '13.0.0';

export const isDefaultLabelsGrafanaVersion = (grafanaVersion: string): boolean => {
  return semver.gte(grafanaVersion, DEFAULT_LABELS_MIN_VERSION);
};

/**
 * Skips the test when Grafana version is below 13.0.0 (default labels and kubernetesLogsDrilldown).
 */
export const skipUnlessDefaultLabelsSupported = ({ grafanaVersion }: { grafanaVersion: string }): void => {
  test.skip(
    !isDefaultLabelsGrafanaVersion(grafanaVersion),
    `Skipping: default labels require Grafana >= ${DEFAULT_LABELS_MIN_VERSION} and kubernetesLogsDrilldown`
  );
};
