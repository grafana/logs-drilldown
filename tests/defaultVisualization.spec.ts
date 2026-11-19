import type { Page } from '@playwright/test';

import { expect, test } from '@grafana/plugin-e2e';
import { LogsSortOrder } from '@grafana/schema';

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

  for (const [label, wrap, prettify] of [
    ['Disabled', false, false],
    ['Enabled', true, false],
    ['Enabled with JSON formatting', true, true],
  ] as const) {
    test(`applies saved ${label} wrapping and unwrapped columns to the Logs panel`, async ({ page }) => {
      const saved = await configureDefault(page);
      await page.goto(`/plugins/${pluginId}/?page=configuration`);
      await page
        .getByTestId(testIds.appConfig.logsPanel.wrapping)
        .getByRole('radio', { name: 'Disabled', exact: true })
        .check();
      await page
        .getByTestId(testIds.appConfig.logsPanel.columns)
        .getByRole('radio', { name: 'Enabled', exact: true })
        .check();
      await page
        .getByTestId(testIds.appConfig.logsPanel.wrapping)
        .getByRole('radio', { name: label, exact: true })
        .check();
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().endsWith(`/api/plugins/${pluginId}/settings`) && response.request().method() === 'POST'
        ),
        page.getByTestId(testIds.appConfig.submit).click(),
      ]);
      expect(saved()).toMatchObject({
        defaultWrapLogMessage: wrap,
        defaultPrettifyLogMessage: prettify,
        defaultUnwrappedColumns: true,
      });
      await openLogs(page, 'logs');
      const wrapping = page.getByRole('button', { name: 'Set line wrap', exact: true });
      await expect(wrapping).toHaveAttribute('aria-pressed', String(wrap));
      await expect(wrapping).toHaveText(prettify ? '+' : '');
      const columns = page.getByRole('button', { name: /columns/i });
      if (wrap) {
        await expect(columns).toBeDisabled();
      } else {
        await expect(columns).toHaveAttribute('aria-pressed', 'true');
      }
    });
  }

  test('preserves a URL choice ahead of the browser preference and configured default', async ({ page }) => {
    await configureDefault(page, 'json');
    await openLogs(page, 'logs');
    await expect(
      page.getByTestId(testIds.logsPanelHeader.visualizationType).getByRole('radio', { name: 'Logs', exact: true })
    ).toBeChecked();
  });

  test('applies saved Logs timestamps, font, sort, details mode, and highlighting after clearing localStorage', async ({
    page,
  }) => {
    const saved = await configureDefault(page);
    await page.goto(`/plugins/${pluginId}/?page=configuration`);
    for (const [id, name] of [
      [testIds.appConfig.logsPanel.wrapping, 'Disabled'],
      [testIds.appConfig.logsPanel.timestamps, 'Nanoseconds'],
      [testIds.appConfig.logsPanel.fontSize, 'Small'],
      [testIds.appConfig.logsPanel.sortOrder, 'Oldest first'],
      [testIds.appConfig.logsPanel.detailsMode, 'Sidebar'],
      [testIds.appConfig.logsPanel.syntaxHighlighting, 'Disabled'],
    ]) {
      await page.getByTestId(id).getByRole('radio', { name, exact: true }).check();
    }
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith(`/api/plugins/${pluginId}/settings`) && r.request().method() === 'POST'
      ),
      page.getByTestId(testIds.appConfig.submit).click(),
    ]);
    await expect(
      page.getByTestId(testIds.appConfig.logsPanel.fontSize).getByRole('radio', { name: 'Small', exact: true })
    ).toBeChecked();
    expect(saved()).toMatchObject({
      defaultShowTime: true,
      defaultTimestampResolution: 'ns',
      defaultFontSize: 'small',
      defaultSortOrder: LogsSortOrder.Ascending,
      defaultDetailsMode: 'sidebar',
      defaultSyntaxHighlighting: false,
    });
    await page.evaluate(() => localStorage.clear());
    await openLogs(page, 'logs');
    await expect(page.getByRole('button', { name: 'Log timestamps', exact: true })).toHaveText('ns');
    await expect(page.getByRole('button', { name: 'Set large font', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(
      page.getByRole('button', { name: 'Sorted by oldest logs first - Click to show newest first', exact: true })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enable highlighting', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    await page.locator('.unwrapped-log-line').first().click();
    await expect(page.getByRole('button', { name: 'Display inline', exact: true })).toBeVisible();
  });

  test('applies saved Table wrapping and sort order after clearing localStorage', async ({ page }) => {
    const saved = await configureDefault(page);
    await page.goto(`/plugins/${pluginId}/?page=configuration`);
    await page
      .getByTestId(testIds.appConfig.tablePanel.wrapping)
      .getByRole('radio', { name: 'Disabled', exact: true })
      .check();
    await page
      .getByTestId(testIds.appConfig.tablePanel.sortOrder)
      .getByRole('radio', { name: 'Oldest first', exact: true })
      .check();
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith(`/api/plugins/${pluginId}/settings`) && r.request().method() === 'POST'
      ),
      page.getByTestId(testIds.appConfig.submit).click(),
    ]);
    await expect(
      page.getByTestId(testIds.appConfig.tablePanel.wrapping).getByRole('radio', { name: 'Disabled', exact: true })
    ).toBeChecked();
    expect(saved()).toMatchObject({ defaultTableWrapText: false, defaultTableSortOrder: LogsSortOrder.Ascending });
    await page.evaluate(() => localStorage.clear());
    await openLogs(page, 'table');
    await expect(page.getByRole('button', { name: 'Enable text wrapping', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    await expect(
      page.getByRole('button', { name: 'Sorted by oldest logs first - Click to show newest first', exact: true })
    ).toBeVisible();
  });

  test('applies saved JSON sort order, wrapping, and highlighting after clearing localStorage', async ({ page }) => {
    const saved = await configureDefault(page);
    await page.goto(`/plugins/${pluginId}/?page=configuration`);
    await page
      .getByTestId(testIds.appConfig.jsonPanel.sortOrder)
      .getByRole('radio', { name: 'Oldest first', exact: true })
      .check();
    await page
      .getByTestId(testIds.appConfig.jsonPanel.wrapping)
      .getByRole('radio', { name: 'Disabled', exact: true })
      .check();
    await page
      .getByTestId(testIds.appConfig.jsonPanel.syntaxHighlighting)
      .getByRole('radio', { name: 'Enabled', exact: true })
      .check();
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith(`/api/plugins/${pluginId}/settings`) && r.request().method() === 'POST'
      ),
      page.getByTestId(testIds.appConfig.submit).click(),
    ]);
    await expect(
      page.getByTestId(testIds.appConfig.jsonPanel.wrapping).getByRole('radio', { name: 'Disabled', exact: true })
    ).toBeChecked();
    expect(saved()).toMatchObject({
      defaultJSONSortOrder: LogsSortOrder.Ascending,
      defaultJSONWrapLogMessage: false,
      defaultJSONSyntaxHighlighting: true,
    });
    await page.evaluate(() => localStorage.clear());
    await openLogs(page, 'json');
    await expect(page.getByRole('button', { name: 'Set newest logs first', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Wrap lines', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    await expect(page.getByRole('button', { name: 'Disable highlighting', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});
