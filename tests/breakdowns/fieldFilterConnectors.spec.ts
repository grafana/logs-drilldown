import { expect, test } from '@grafana/plugin-e2e';

import { LokiQuery } from '../../src/services/lokiQuery';
import { testIds } from '../../src/services/testIds';
import { skipUnlessLatestGrafana } from '../config/grafana-versions-supported';
import { DEFAULT_STATIC_URL_SEARCH_PARAMS, STATIC_FROM, STATIC_TO } from '../config/constants';
import { ExplorePage } from '../fixtures/explore';

// `caller` is parsed with logfmt, `pod` is structured metadata in the static snapshot
const caller = 'instance.go:43';
const pod = 'tempo-distributor-ap607';

const isLogsPanelQuery = (query: LokiQuery) => query.refId === 'logsPanelQuery';

function getServiceLogsUrl() {
  const params = new URLSearchParams(DEFAULT_STATIC_URL_SEARCH_PARAMS);
  params.append('var-filters', 'service_name|=|tempo-distributor');
  params.append('var-metadata', `pod|=|${pod}`);
  params.append('var-fields', `caller|=|{"parser":"logfmt"__gfc__"value":"${caller}"},${caller}`);
  return `/a/grafana-lokiexplore-app/explore/service/tempo-distributor/logs?${params.toString()}`;
}

test.describe('Field filter connectors', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page, grafanaVersion }, testInfo) => {
    skipUnlessLatestGrafana({ grafanaVersion });
    explorePage = new ExplorePage(page, testInfo);
    await explorePage.setExtraTallViewportSize();
    await explorePage.clearLocalStorage();
    explorePage.captureConsoleLogs();
  });

  test.afterEach(async () => {
    await explorePage.unroute();
    explorePage.echoConsoleLogsOnRetry();
  });

  test('combines metadata and parsed field filters with OR, and back with AND', async ({ page }) => {
    explorePage.blockAllQueriesExcept({ legendFormats: [], refIds: ['logsPanelQuery'] });
    const orStage = `| pod="${pod}" or caller="${caller}"`;
    let logsQuery: LokiQuery | undefined;

    await explorePage.waitForRequest(
      () => page.goto(getServiceLogsUrl()),
      (query) => (logsQuery = query),
      isLogsPanelQuery
    );
    const connector = page.getByTestId(testIds.variables.fields.filterConnector);
    await expect(connector).toHaveCount(1);
    await expect(connector).toHaveText('and');
    expect(logsQuery?.expr).toContain(`| pod="${pod}"`);
    expect(logsQuery?.expr).toContain(`| caller="${caller}"`);
    expect(logsQuery?.expr).not.toContain(' or ');

    await explorePage.waitForRequest(
      () => connector.click(),
      (query) => (logsQuery = query),
      (query) => isLogsPanelQuery(query) && query.expr.includes(orStage)
    );
    await expect(connector).toHaveText('or');
    // Both filters are rendered once, in a single pipeline stage after the parser
    expect(logsQuery?.expr.split('pod=')).toHaveLength(2);
    expect(logsQuery?.expr.indexOf(orStage)).toBeGreaterThan(logsQuery?.expr.indexOf('| logfmt') ?? -1);
    expect(decodeURIComponent(page.url())).toContain('"orGroup":1');
    await expect(explorePage.getLogsPanelRow(0)).toBeVisible();

    // The OR group is restored from the URL
    await explorePage.waitForRequest(
      () => page.reload(),
      () => {},
      (query) => isLogsPanelQuery(query) && query.expr.includes(orStage)
    );
    await expect(connector).toHaveText('or');

    await explorePage.waitForRequest(
      () => connector.click(),
      (query) => (logsQuery = query),
      (query) => isLogsPanelQuery(query) && !query.expr.includes(' or ')
    );
    await expect(connector).toHaveText('and');
    expect(logsQuery?.expr).toContain(`| pod="${pod}"`);
    expect(logsQuery?.expr).toContain(`| caller="${caller}"`);
    expect(decodeURIComponent(page.url())).not.toContain('orGroup');
  });

  test('keeps "or" from a query opened from Explore', async ({ page }) => {
    const expr = `{service_name="tempo-distributor"} | logfmt | caller="${caller}" or pod="${pod}"`;
    const panes = {
      dx6: {
        datasource: 'gdev-loki',
        queries: [{ datasource: { type: 'loki', uid: 'gdev-loki' }, expr, refId: 'A' }],
        range: { from: STATIC_FROM, to: STATIC_TO },
      },
    };
    await page.goto(`/explore?schemaVersion=1&panes=${encodeURIComponent(JSON.stringify(panes))}&orgId=1`);
    await expect(page.getByTestId('logRows').first()).toBeVisible();

    await page.getByText('Go queryless').click();
    await page.getByLabel('Open in Grafana Logs Drilldown').first().click();

    let logsQuery: LokiQuery | undefined;
    await explorePage.waitForRequest(
      () => page.getByRole('button', { exact: true, name: 'Open' }).click(),
      (query) => (logsQuery = query),
      (query) => isLogsPanelQuery(query) && query.expr.includes(' or ')
    );

    const connector = page.getByTestId(testIds.variables.fields.filterConnector);
    await expect(connector).toHaveCount(1);
    await expect(connector).toHaveText('or');
    expect(logsQuery?.expr).toContain(`| caller="${caller}" or pod="${pod}"`);
    await expect(explorePage.getLogsPanelRow(0)).toBeVisible();
  });
});
