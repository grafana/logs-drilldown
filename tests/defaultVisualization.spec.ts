import type { Page } from '@playwright/test';

import { expect, test } from '@grafana/plugin-e2e';

import type { JsonData } from '../src/Components/AppConfig/AppConfig';
import type { LogsVisualizationType } from '../src/services/store';
import { testIds } from '../src/services/testIds';
import { DEFAULT_STATIC_URL_SEARCH_PARAMS } from './config/constants';
import { skipUnlessLatestGrafana } from './config/grafana-versions-supported';

const pluginId = 'grafana-lokiexplore-app';

async function configureDefault(page: Page, preference?: LogsVisualizationType) {
  let jsonData: JsonData = { defaultVisualizationType: 'table' };
  await page.route(`**/api/plugins/${pluginId}/settings`, async (route) => {
    if (route.request().method() === 'POST') {
      jsonData = route.request().postDataJSON().jsonData;
      await route.fulfill({ json: { message: 'Plugin settings updated' } });
      return;
    }
    const response = await route.fetch();
    const settings = await response.json();
    await route.fulfill({ response, json: { ...settings, jsonData: { ...settings.jsonData, ...jsonData } } });
  });
  await page.addInitScript((value) => {
    const key = 'grafana.explore.logs.visualisationType';
    localStorage.removeItem(key);
    if (value) {
      localStorage.setItem(key, value);
    }
  }, preference);
  return () => jsonData;
}

async function openLogs(page: Page, visualizationType?: LogsVisualizationType) {
  const params = new URLSearchParams(DEFAULT_STATIC_URL_SEARCH_PARAMS);
  params.set('var-filters', 'service_name|=|tempo-distributor');
  if (visualizationType) {
    params.set('visualizationType', JSON.stringify(visualizationType));
  }
  await page.goto(`/a/${pluginId}/explore/service/tempo-distributor/logs?${params}`);
  await expect(page.getByTestId(testIds.logsQueryFooter.details)).toBeVisible();
}

test.describe('Default visualization', () => {
  test.beforeEach(skipUnlessLatestGrafana);
  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: 'wait' });
  });

  for (const [type, label] of [
    ['logs', 'Logs'],
    ['table', 'Table'],
    ['json', 'JSON'],
  ] as const) {
    test(`saves ${label} in Configuration and opens that panel view`, async ({ page }) => {
      const saved = await configureDefault(page);
      await page.goto(`/plugins/${pluginId}/?page=configuration`);
      const control = page.getByTestId(testIds.appConfig.defaultVisualizationType);
      await control.getByRole('radio', { name: label, exact: true }).check();
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().endsWith(`/api/plugins/${pluginId}/settings`) && response.request().method() === 'POST'
        ),
        page.getByTestId(testIds.appConfig.submit).click(),
      ]);
      await expect(control.getByRole('radio', { name: label, exact: true })).toBeChecked();
      expect(saved().defaultVisualizationType).toBe(type);
      await openLogs(page);
      await expect(
        page.getByTestId(testIds.logsPanelHeader.visualizationType).getByRole('radio', { name: label, exact: true })
      ).toBeChecked();
    });
  }

  test('preserves a browser preference ahead of the configured default', async ({ page }) => {
    await configureDefault(page, 'json');
    await openLogs(page);
    await expect(
      page.getByTestId(testIds.logsPanelHeader.visualizationType).getByRole('radio', { name: 'JSON', exact: true })
    ).toBeChecked();
  });

  test('preserves a URL choice ahead of the browser preference and configured default', async ({ page }) => {
    await configureDefault(page, 'json');
    await openLogs(page, 'logs');
    await expect(
      page.getByTestId(testIds.logsPanelHeader.visualizationType).getByRole('radio', { name: 'Logs', exact: true })
    ).toBeChecked();
  });
});
