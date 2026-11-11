import { expect, test } from '@grafana/plugin-e2e';

import { testIds } from '../src/services/testIds';
import { skipUnlessLatestGrafana } from './config/grafana-versions-supported';
import { ExplorePage } from './fixtures/explore';

const SETTINGS_URL = '**/api/plugins/grafana-lokiexplore-app/settings';

test.describe('Log defaults', () => {
  test.beforeEach(({ grafanaVersion }) => skipUnlessLatestGrafana({ grafanaVersion }));

  test('config page shows the options and lets admins pick values', async ({ page }) => {
    await page.goto('/grafana/plugins/grafana-lokiexplore-app?page=admin-log-defaults');
    const container = page.getByTestId(testIds.appConfig.logDefaults.container);
    await expect(container).toBeVisible();

    const groups = container.getByRole('radiogroup');
    await expect(groups).toHaveCount(4);
    // Every option starts as "Not set"
    for (const group of await groups.all()) {
      await expect(group.getByLabel('Not set')).toBeChecked();
    }

    await groups.nth(0).getByLabel('Wrap', { exact: true }).click();
    await expect(groups.nth(0).getByLabel('Wrap', { exact: true })).toBeChecked();
    await groups.nth(0).getByLabel('Not set').click();
    await expect(groups.nth(0).getByLabel('Not set')).toBeChecked();
    // Don't save, or we could break other tests that share the plugin settings
  });

  test('logs panel uses admin defaults, user choices win, and reset restores them', async ({ page }, testInfo) => {
    // Inject admin defaults into the plugin settings instead of saving them
    await page.route(SETTINGS_URL, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.jsonData = { ...body.jsonData, logDefaults: { wrapLogMessage: true, sortOrder: 'Ascending' } };
      await route.fulfill({ response, json: body });
    });

    const explorePage = new ExplorePage(page, testInfo);
    await explorePage.setExtraTallViewportSize();
    await explorePage.gotoServicesBreakdownOldUrl();
    await explorePage.clearLocalStorage();
    await page.reload();
    await explorePage.goToLogsTab();

    // Admin default: wrap on, oldest first
    await expect(explorePage.getLogsWrapToggle()).toHaveAttribute('aria-pressed', 'true');
    await expect(explorePage.getLogsDirectionOldestFirstLocator()).toBeVisible();

    // User choice wins over the admin default
    await explorePage.setLogsLineWrapMenu(false);
    await expect(explorePage.getLogsWrapToggle()).toHaveAttribute('aria-pressed', 'false');

    // Reset goes back to the admin default
    await page.getByTestId(testIds.logsPanelHeader.resetLogOptions).click();
    await expect(explorePage.getLogsWrapToggle()).toHaveAttribute('aria-pressed', 'true');
  });
});
