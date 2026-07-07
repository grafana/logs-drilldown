import { expect, test } from '@grafana/plugin-e2e';

import pluginJson from '../src/plugin.json';
import { testIds } from '../src/services/testIds';
import { STATIC_FROM, STATIC_TO } from './config/constants';
import { skipUnlessLatestGrafana } from './config/grafana-versions-supported';
import { ExplorePage } from './fixtures/explore';

// A drilldown URL carrying invalid jsonFields/lineFormat values used to interpolate a malformed
// query (`| json trueundefined""`, `| line_format "{{.true}}"`), which surfaced a "parse error" and
// broke the logs view until a hard refresh. Landing on such a URL must now load without error:
// AdHocFiltersVariable drops the invalid filter on URL parse, and re-entering a service (which reuses the
// pathname-cached scene) re-syncs the drilldown-only variables to the URL via resetVariablesIfNotInUrl.
//
const queryErrorText = /invalid filter parameters|Unexpected error response|parse error|JSON\.parse|unexpected/i;

test.describe('invalid drilldown URL state (#1976)', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page, grafanaVersion }, testInfo) => {
    skipUnlessLatestGrafana({ grafanaVersion });
    explorePage = new ExplorePage(page, testInfo);
    await explorePage.setDefaultViewportSize();
    await explorePage.clearLocalStorage();
    explorePage.captureConsoleLogs();
    explorePage.blockAllQueriesExcept({
      refIds: ['logsPanelQuery', /gld-sample-\d+/, /^logs-.+/],
    });
  });

  test.afterEach(async () => {
    if (!explorePage) {
      return;
    }
    await explorePage.unroute();
    explorePage.echoConsoleLogsOnRetry();
  });

  test('landing on a URL with invalid jsonFields/lineFormat loads without an error', async ({ page }) => {
    const range = `from=${encodeURIComponent(STATIC_FROM)}&to=${encodeURIComponent(STATIC_TO)}`;

    // Drilldown URL carrying the stuck, invalid values from the bug report:
    //   var-jsonFields=true|undefined|  ->  `| json trueundefined""`
    //   var-lineFormat=true|=|          ->  `| line_format "{{.true}}"`
    const invalidUrl =
      `/a/${pluginJson.id}/explore/service/tempo-distributor/logs?${range}` +
      `&var-ds=gdev-loki&var-filters=service_name%7C%3D%7Ctempo-distributor&patterns=%5B%5D` +
      `&var-fields=&var-levels=&var-patterns=&timezone=utc` +
      `&var-lineFormat=true%7C%3D%7C&var-jsonFields=true%7Cundefined%7C` +
      `&var-metadata=&var-all-fields=&var-lineFilterV2=&var-lineFilters=` +
      `&urlColumns=%5B%5D&visualizationType=%22logs%22&displayedFields=%5B%5D&sortOrder=%22Descending%22&wrapLogMessage=true`;

    // Land directly on the bad URL: the logs view loads instead of crashing with a malformed query.
    await page.goto(invalidUrl);
    await expect(page.getByTestId(testIds.exploreServiceDetails.tabLogs)).toBeVisible();
    await explorePage.assertNotLoading();
    await expect(page.getByText(queryErrorText)).toHaveCount(0);
  });
});
