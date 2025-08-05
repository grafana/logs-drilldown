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

  test('can load', async ({ page }) => {
    await page.goto('/a/grafana-lokiexplore-app/explore');
    await page.pause();
    await expect(page.getByText('Grafana Logs Drilldown').first()).toBeVisible();
    await expect(page.getByText('Grafana Logs Drilldown').last()).toBeVisible();
  });
});
