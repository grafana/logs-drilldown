import type { Page, Request } from '@playwright/test';

import { expect, test } from '@grafana/plugin-e2e';
import { LogsSortOrder } from '@grafana/schema';

import type { JsonData } from '../src/Components/AppConfig/AppConfig';
import type { LokiQuery } from '../src/services/lokiQuery';
import type { LogsVisualizationType } from '../src/services/store';
import { testIds } from '../src/services/testIds';
import { DEFAULT_STATIC_URL_SEARCH_PARAMS } from './config/constants';
import { skipUnlessLatestGrafana } from './config/grafana-versions-supported';

const pluginId = 'grafana-lokiexplore-app';

function getLogsQuery(request: Request): LokiQuery | undefined {
  if (!request.url().includes('/api/ds/query') || request.method() !== 'POST') {
    return undefined;
  }
  const queries: LokiQuery[] = request.postDataJSON()?.queries ?? [];
  return queries.find((query) => query.refId === 'logsPanelQuery');
}

async function configureDefault(
  page: Page,
  preference?: LogsVisualizationType,
  initialJsonData: JsonData = { defaultVisualizationType: 'table' }
) {
  let jsonData: JsonData = { dataSource: 'gdev-loki', ...initialJsonData };
  await page.route(`**/api/plugins/${pluginId}/settings`, async (route) => {
    if (route.request().method() === 'POST') {
      jsonData = route.request().postDataJSON().jsonData;
      await route.fulfill({ json: { message: 'Plugin settings updated' } });
      return;
    }
    const response = await route.fetch();
    const settings = await response.json();
    await route.fulfill({ response, json: { ...settings, jsonData } });
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

  test('does not pin panel defaults when only the time range changes', async ({ page }) => {
    const saved = await configureDefault(page, undefined, {});
    await page.goto(`/plugins/${pluginId}/?page=configuration`);
    const checkbox = page.getByTestId(testIds.appConfig.defaultTimeRangeEnabled);
    const label = page.locator('label').filter({ has: checkbox });
    await label.click();
    await page.getByTestId(testIds.appConfig.defaultTimeRangeFrom).fill('now-1h');
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith(`/api/plugins/${pluginId}/settings`) && r.request().method() === 'POST'
      ),
      page.getByTestId(testIds.appConfig.submit).click(),
    ]);
    await expect(page.getByTestId(testIds.appConfig.defaultTimeRangeFrom)).toHaveValue('now-1h');
    expect(saved()).toEqual({
      dataSource: 'gdev-loki',
      interval: '',
      patternsDisabled: false,
      defaultTimeRange: { from: 'now-1h', to: 'now' },
    });
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith(`/api/plugins/${pluginId}/settings`) && r.request().method() === 'POST'
      ),
      page.getByTestId(testIds.appConfig.submit).click(),
    ]);
    await expect(page.getByTestId(testIds.appConfig.defaultTimeRangeFrom)).toHaveValue('now-1h');
    expect(Object.keys(saved()).filter((key) => key.startsWith('default'))).toEqual(['defaultTimeRange']);
  });

  for (const logsTablePanelNG of [true, false]) {
    test(`refetches capped logs when switching to a different sort default (logsTablePanelNG=${logsTablePanelNG})`, async ({
      page,
    }) => {
      await page.addInitScript(
        (value) => localStorage.setItem('grafana.openfeature.logsTablePanelNG', String(value)),
        logsTablePanelNG
      );
      await configureDefault(page, undefined, {
        defaultVisualizationType: 'logs',
        defaultSortOrder: LogsSortOrder.Descending,
        defaultTableSortOrder: LogsSortOrder.Ascending,
        defaultJSONSortOrder: LogsSortOrder.Descending,
      });
      const queries: LokiQuery[] = [];
      page.on('request', (request) => {
        const query = getLogsQuery(request);
        if (query) {
          queries.push(query);
        }
      });
      const selector = page.getByTestId(testIds.logsPanelHeader.visualizationType);
      for (const type of ['logs', 'json'] as const) {
        await openLogs(page, type);
        expect(queries.at(-1)).toMatchObject({ direction: 'backward', maxLines: 1000 });
        await Promise.all([
          page.waitForResponse((response) => getLogsQuery(response.request())?.direction === 'forward'),
          selector.getByRole('radio', { name: 'Table', exact: true }).check(),
        ]);
        await expect(selector.getByRole('radio', { name: 'Table', exact: true })).toBeChecked();
        expect(queries.at(-1)).toMatchObject({ direction: 'forward', maxLines: 1000 });
      }
    });
  }

  test('keeps the existing results when a saved sort preference applies to both visualizations', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('grafana.openfeature.logsTablePanelNG', 'true'));
    await page.addInitScript(() => localStorage.setItem('grafana.explore.logs.sortOrder', 'Descending'));
    await configureDefault(page, undefined, {
      defaultSortOrder: LogsSortOrder.Descending,
      defaultTableSortOrder: LogsSortOrder.Ascending,
    });
    let requests = 0;
    page.on('request', (request) => {
      if (getLogsQuery(request)) {
        requests++;
      }
    });
    await openLogs(page, 'logs');
    const initialRequests = requests;
    await page
      .getByTestId(testIds.logsPanelHeader.visualizationType)
      .getByRole('radio', { name: 'Table', exact: true })
      .check();
    await expect(
      page.getByRole('button', { name: 'Sorted by newest logs first - Click to show oldest first', exact: true })
    ).toBeVisible();
    await page.waitForTimeout(500);
    expect(requests).toBe(initialRequests);
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
        ...(wrap ? { defaultWrapLogMessage: true } : {}),
        ...(prettify ? { defaultPrettifyLogMessage: true } : {}),
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

  test('applies the configured sort order to the legacy Table and its Loki query', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('grafana.openfeature.logsTablePanelNG', 'false'));
    await configureDefault(page, undefined, {
      defaultTableSortOrder: LogsSortOrder.Ascending,
      defaultSortOrder: LogsSortOrder.Descending,
    });
    const directions: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/ds/query') && request.method() === 'POST') {
        const queries = request.postDataJSON()?.queries;
        for (const query of queries ?? []) {
          if (query.refId === 'logsPanelQuery') {
            directions.push(query.direction);
          }
        }
      }
    });
    await openLogs(page, 'table');
    await expect(page.getByRole('button', { name: 'Set newest logs first', exact: true })).toBeVisible();
    await expect.poll(() => directions.length).toBeGreaterThan(0);
    expect(directions.every((direction) => direction === 'forward')).toBe(true);
  });

  for (const [width, modeButton] of [
    [2560, 'Display inline'],
    [1280, 'Anchor to the right'],
  ] as const) {
    test(`keeps responsive details mode at width ${width} when no default is configured`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1100 });
      await configureDefault(page, undefined, {
        defaultDetailsMode: undefined,
        defaultWrapLogMessage: false,
      });
      await page.addInitScript(() => localStorage.removeItem('grafana.explore.logs.detailsMode'));
      await openLogs(page, 'logs');
      await page.locator('[data-log-index]').first().locator('> div').click();
      await expect(page.getByRole('button', { name: modeButton, exact: true })).toBeVisible();
    });
  }

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
    await page.addInitScript(() => localStorage.setItem('grafana.openfeature.logsTablePanelNG', 'true'));
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
