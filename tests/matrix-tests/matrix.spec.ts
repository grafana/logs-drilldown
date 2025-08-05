import { expect, test } from '@grafana/plugin-e2e';

import { ExplorePage } from '../fixtures/explore';

test.describe('matrix', () => {
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

  test('can load', async ({ page }) => {
    await page.goto('/a/grafana-lokiexplore-app/explore?from=now-1m&to=now');
    await expect(page.getByText('Grafana Logs Drilldown').first()).toBeVisible();
    await expect(page.getByText('Grafana Logs Drilldown').last()).toBeVisible();
  });

  test('can open viz menu without error - logs tab', async ({ page }) => {
    await page.goto('/a/grafana-lokiexplore-app/explore?from=now-15s&to=now');
    // Click on first service
    await page.getByText('Show logs').nth(1).click();
    await explorePage.assertTwoPanelMenus();
  });

  test('can open viz menu without error - labels tab', async ({ page }) => {
    await page.goto('/a/grafana-lokiexplore-app/explore?from=now-15s&to=now');
    // Click on first service
    await page.getByText('Show logs').nth(1).click();
    await explorePage.goToLabelsTab();
    await explorePage.assertBreakdownPanelMenus();
  });

  test('can open viz menu without error - fields tab', async ({ page }) => {
    await page.goto('/a/grafana-lokiexplore-app/explore?from=now-15s&to=now');
    // Click on first service
    await page.getByText('Show logs').nth(1).click();
    await explorePage.goToFieldsTab();
    await explorePage.assertBreakdownPanelMenus();
  });
});
