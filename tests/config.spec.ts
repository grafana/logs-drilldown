import { expect, test } from '@grafana/plugin-e2e';

import { GRAFANA_LATEST_SUPPORTED_VERSION, isLatestGrafana } from './config/grafana-versions-supported';

test.describe('Plugin config', () => {
  test.beforeEach(async ({ grafanaVersion }) => {
    test.skip(!isLatestGrafana(grafanaVersion), `Skipping: requires Grafana >= ${GRAFANA_LATEST_SUPPORTED_VERSION}`);
  });

  test('plugin config can load', async ({ page }) => {
    await page.goto('/plugins/grafana-lokiexplore-app/');
    await expect(page.getByText('Grafana Logs Drilldown').first()).toBeVisible();
    await expect(page.getByText('Settings').first()).toBeVisible();
    await expect(page.getByText('Default data source').first()).toBeVisible();
    await expect(page.getByText('Maximum time picker interval').first()).toBeVisible();

    const disablePatternsLabelLoc = page.getByText('Disable patterns');

    // Check box
    await expect(disablePatternsLabelLoc).toBeVisible();
    await expect(disablePatternsLabelLoc).not.toBeChecked();
    await disablePatternsLabelLoc.click();
    await expect(disablePatternsLabelLoc).toBeChecked();
    // Don't save config changes or we could break this or other tests if execution is interrupted or run in parallel
  });
});
