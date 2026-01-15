import semver from 'semver';
export const GRAFANA_LATEST_SUPPORTED_VERSION = '12.3.1';
/**
 * Check if the current Grafana version is the latest supported version or newer.
 * Used to skip tests that should only run on the latest Grafana version.
 */
export const isLatestGrafana = (grafanaVersion: string): boolean => {
  return semver.gte(grafanaVersion, GRAFANA_LATEST_SUPPORTED_VERSION);
};
