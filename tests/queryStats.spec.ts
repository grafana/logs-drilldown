import { expect, test } from '@grafana/plugin-e2e';

import { testIds } from '../src/services/testIds';
import { skipUnlessLatestGrafana } from './config/grafana-versions-supported';
import { ExplorePage } from './fixtures/explore';

test('shows an estimated query size before logs results arrive', async ({ page, grafanaVersion }, testInfo) => {
  skipUnlessLatestGrafana({ grafanaVersion });
  let releaseLogs: () => void = () => {};
  const logsHeld = new Promise<void>((resolve) => (releaseLogs = resolve));
  let logsRequested = false;
  let logsReleased = false;

  await page.route('**/resources/index/stats**', (route) =>
    route.fulfill({ json: { streams: 1, chunks: 1, entries: 100, bytes: 1048576 } })
  );
  await page.route('**/ds/query**', async (route) => {
    const queries = route.request().postDataJSON()?.queries;
    if (!queries?.some((query: { refId: string }) => query.refId === 'logsPanelQuery')) {
      await route.continue();
      return;
    }
    logsRequested = true;
    await logsHeld;
    await route.fulfill({
      json: {
        results: {
          logsPanelQuery: {
            status: 200,
            frames: [
              {
                schema: {
                  refId: 'logsPanelQuery',
                  fields: [],
                  meta: {
                    stats: [{ displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 2097152 }],
                  },
                },
                data: { values: [] },
              },
            ],
          },
        },
      },
    });
    logsReleased = true;
  });

  try {
    const explorePage = new ExplorePage(page, testInfo);
    await explorePage.gotoServicesBreakdownOldUrl();
    const estimate = page.getByTestId(testIds.exploreServiceDetails.querySizeEstimate);
    await expect(estimate).toHaveText('This query processes approximately 1.0 MiB');
    await expect.poll(() => logsRequested).toBe(true);
    expect(logsReleased).toBe(false);
    await page.screenshot({ path: testInfo.outputPath('query-estimate-before-logs.png'), fullPage: true });

    const logsResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/ds/query') &&
        response
          .request()
          .postDataJSON()
          ?.queries?.some((query: { refId: string }) => query.refId === 'logsPanelQuery')
    );
    releaseLogs();
    await (await logsResponse).finished();
    await expect(estimate).toHaveText('This query processes approximately 1.0 MiB');
    await expect(page.getByTestId(testIds.logsQueryFooter.footer)).toContainText('Total bytes processed');
  } finally {
    releaseLogs();
    await page.unrouteAll({ behavior: 'wait' });
  }
});

test('refreshes the estimate after filters change and keeps it across logs visualizations', async ({
  page,
  grafanaVersion,
}, testInfo) => {
  skipUnlessLatestGrafana({ grafanaVersion });
  let estimatedBytes = 1048576;
  let statsRequests = 0;
  let releaseLogs: () => void = () => {};
  const logsHeld = new Promise<void>((resolve) => (releaseLogs = resolve));
  await page.route('**/ds/query**', async (route) => {
    if (
      route
        .request()
        .postDataJSON()
        ?.queries?.some((query: { refId: string }) => query.refId === 'logsPanelQuery')
    ) {
      await logsHeld;
    }
    await route.continue();
  });
  await page.route('**/resources/index/stats**', (route) => {
    statsRequests++;
    return route.fulfill({ json: { streams: 1, chunks: 1, entries: 100, bytes: estimatedBytes } });
  });
  try {
    const explorePage = new ExplorePage(page, testInfo);
    await explorePage.gotoServicesBreakdownOldUrl();
    const estimate = page.getByTestId(testIds.exploreServiceDetails.querySizeEstimate);
    await expect(estimate).toContainText('1.0 MiB');

    estimatedBytes = 2097152;
    await explorePage.serviceBreakdownSearch.fill('broadcast');
    await explorePage.serviceBreakdownSearch.press('Enter');
    await expect(estimate).toContainText('2.0 MiB');

    await page.getByRole('radio', { name: 'Table', exact: true }).check();
    await expect(estimate).toContainText('2.0 MiB');
    await page.getByRole('radio', { name: 'JSON', exact: true }).check();
    await expect(estimate).toContainText('2.0 MiB');
    await page.getByTestId(testIds.exploreServiceDetails.tabLabels).click();
    await expect(estimate).toContainText('2.0 MiB');
    await page.getByTestId(testIds.exploreServiceDetails.tabLogs).click();
    await expect(estimate).toContainText('2.0 MiB');

    const requestsBeforeCollapse = statsRequests;
    await page.getByTestId(testIds.header.toggleQueryEditor).click();
    await expect(estimate).not.toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('query-editor-collapsed.png'), fullPage: true });
    await page.getByTestId(testIds.header.toggleQueryEditor).click();
    await expect(estimate).toContainText('2.0 MiB');
    expect(statsRequests).toBe(requestsBeforeCollapse);
  } finally {
    releaseLogs();
    await page.unrouteAll({ behavior: 'wait' });
  }
});

test('follows service navigation without carrying the previous estimate', async ({
  page,
  grafanaVersion,
}, testInfo) => {
  skipUnlessLatestGrafana({ grafanaVersion });
  let estimatedBytes = 1048576;
  await page.route('**/resources/index/stats**', (route) =>
    route.fulfill({ json: { streams: 1, chunks: 1, entries: 100, bytes: estimatedBytes } })
  );
  const explorePage = new ExplorePage(page, testInfo);
  await explorePage.gotoServices();
  const estimate = page.getByTestId(testIds.exploreServiceDetails.querySizeEstimate);
  await expect(estimate).not.toBeAttached();
  await explorePage.clickSelectServiceShowLogsLink('tempo-ingester');
  await expect(estimate).toContainText('1.0 MiB');
  await page.getByTestId('data-testid navigation mega-menu').getByRole('link', { name: 'Logs', exact: true }).click();
  await expect(estimate).not.toBeAttached();
  estimatedBytes = 2097152;
  await explorePage.clickSelectServiceShowLogsLink('tempo-distributor');
  await expect(estimate).toContainText('2.0 MiB');
});
