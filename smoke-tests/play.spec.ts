import { expect, test } from '@grafana/plugin-e2e';

import { ExplorePage } from '../tests/fixtures/explore';

test.describe('play', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page }, testInfo) => {
    explorePage = new ExplorePage(page, testInfo);
    await explorePage.clearLocalStorage();
    explorePage.captureConsoleLogs();
    await explorePage.assertNotLoading();
  });

  test.afterEach(async () => {
    await explorePage.unroute();
    explorePage.echoConsoleLogsOnRetry();
  });

  test('app can load', async ({ page }) => {
    await page.goto('/a/grafana-lokiexplore-app/explore');
    await expect(page.getByText('Grafana Logs Drilldown').first()).toBeVisible();
    await expect(page.getByText('Grafana Logs Drilldown').last()).toBeVisible();
  });

  test('plugin config can load', async ({ page }) => {
    await page.goto('/plugins/grafana-lokiexplore-app/');
    await expect(page.getByText('Grafana Logs Drilldown').first()).toBeVisible();
    await expect(page.getByText('Settings').first()).toBeVisible();
    await expect(page.getByText('Default data source').first()).toBeVisible();
    await expect(page.getByText('Maximum time picker interval').first()).toBeVisible();
  });
});
