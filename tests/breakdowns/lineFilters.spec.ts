import { expect, test } from '@grafana/plugin-e2e';

import { testIds } from '../../src/services/testIds';
import { STATIC_FROM, STATIC_TO } from '../config/constants';
import { ExplorePage } from '../fixtures/explore';
import { mockEmptyQueryApiResponse } from '../mocks/mockEmptyQueryApiResponse';

import { setupServiceBreakdownTest, teardownServiceBreakdownTest } from './shared';

test.describe('Line filters', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page, grafanaVersion }, testInfo) => {
    explorePage = await setupServiceBreakdownTest(page, grafanaVersion, testInfo);
  });

  test.afterEach(async () => {
    await teardownServiceBreakdownTest(explorePage);
  });

  test.describe('LogQL and migration', () => {
    test('line filter', async ({ page }) => {
      let requestCount = 0,
        logsCountQueryCount = 0,
        logsPanelQueryCount = 0;

      explorePage.blockAllQueriesExcept({
        legendFormats: [],
        refIds: ['logsPanelQuery'],
      });

      // We don't need to mock the response, but it speeds up the test
      await page.route('**/api/ds/query*', async (route, request) => {
        const mockResponse = mockEmptyQueryApiResponse;
        const rawPostData = request.postData();

        // We only want to mock the actual field requests, and not the initial request that returns us our list of fields
        if (rawPostData) {
          const postData = JSON.parse(rawPostData);
          const refId = postData.queries[0].refId;
          // Field subqueries have a refId of the field name
          if (refId !== 'logsPanelQuery' && refId !== 'logsCountQuery') {
            requestCount++;
            return await route.fulfill({ json: mockResponse });
          }
          if (refId === 'logsCountQuery') {
            logsCountQueryCount++;
          }
          if (refId === 'logsPanelQuery') {
            logsPanelQueryCount++;
          }
        }

        // Otherwise let the request go through normally
        const response = await route.fetch();
        const json = await response.json();
        return route.fulfill({ json, response });
      });

      requestCount = 0;
      logsCountQueryCount = 0;
      logsPanelQueryCount = 0;

      // Locators
      const lastLineFilterLoc = page.getByTestId(testIds.exploreServiceDetails.searchLogs).last();
      const firstLineFilterLoc = page.getByTestId(testIds.exploreServiceDetails.searchLogs).first();
      const logsPanelContent = explorePage.getLogsPanelLocator().getByTestId('data-testid panel content');
      const rows = logsPanelContent.locator('.unwrapped-log-line');
      const firstRow = rows.nth(0);
      const highlightedMatchesInFirstRow = firstRow.locator('.token.log-search-match');

      await explorePage.goToLogsTab();
      await expect(lastLineFilterLoc).toHaveCount(1);
      await expect(logsPanelContent).toHaveCount(1);
      await expect(firstRow).toHaveCount(1);
      await expect(highlightedMatchesInFirstRow).toHaveCount(0);

      // One logs panel query should have fired
      expect(logsCountQueryCount).toEqual(1);
      expect(logsPanelQueryCount).toEqual(1);

      await lastLineFilterLoc.click();
      await page.keyboard.type('Debug');
      await lastLineFilterLoc.press('Enter');
      await expect.poll(() => highlightedMatchesInFirstRow.count()).toBeGreaterThanOrEqual(1);

      // Now 2 queries should have fired
      expect(logsCountQueryCount).toEqual(2);
      expect(logsPanelQueryCount).toEqual(2);

      // switch to case-sensitive in the global variable
      await page.getByLabel('Enable case match').nth(0).click();
      await expect(page.getByText('No logs match your search.')).toHaveCount(1);
      expect(logsCountQueryCount).toEqual(3);
      expect(logsPanelQueryCount).toEqual(3);

      // Clear the text - should trigger query
      await page.getByLabel('Remove line filter').click();
      // Enable regex - should not trigger empty query
      await page.getByLabel('Enable regex').click();
      await expect(page.getByLabel('Enable regex')).toHaveCount(0);
      await expect(page.getByLabel('Disable regex')).toHaveCount(1);
      // Enable case - should not trigger empty query
      await page.getByLabel('Enable case match').click();
      await expect(page.getByLabel('Disable case match')).toHaveCount(1);
      await expect(page.getByLabel('Enable case match')).toHaveCount(0);
      await expect(firstRow).toHaveCount(1);
      expect(logsCountQueryCount).toEqual(4);
      expect(logsPanelQueryCount).toEqual(4);

      // Add regex string
      await lastLineFilterLoc.click();
      await page.keyboard.type('[dD]ebug');
      await lastLineFilterLoc.press('Enter');
      await expect.poll(() => highlightedMatchesInFirstRow.count()).toBe(1);
      expect(logsCountQueryCount).toEqual(5);
      expect(logsPanelQueryCount).toEqual(5);

      // Disable regex - expect no results show
      await page.getByLabel('Disable regex').nth(0).click();

      // This is debounced, wait for the state to change
      await expect
        .poll(() => page.getByLabel('Enable regex').count(), {
          intervals: [2_001, 50, 100, 250],
        })
        .toBe(1);
      await expect(page.getByText('No logs match your search.')).toHaveCount(1);
      expect(logsCountQueryCount).toEqual(6);
      expect(logsPanelQueryCount).toEqual(6);

      // Re-enable regex - results should show (one regex toggle per line filter row)
      await page.getByLabel('Enable regex').click();
      await expect(page.getByLabel('Disable regex')).toBeVisible();
      await expect.poll(() => highlightedMatchesInFirstRow.count()).toEqual(1);
      expect(logsCountQueryCount).toEqual(7);
      expect(logsPanelQueryCount).toEqual(7);

      // Change the filter in the "saved" variable that will return 0 results
      await firstLineFilterLoc.click();
      await page.keyboard.type('__');
      await expect(page.getByTestId('data-testid search-logs').first()).toHaveValue('[dD]ebug__');
      await expect(page.getByText('No logs match your search.')).toHaveCount(1);
      expect(logsCountQueryCount).toEqual(8);
      expect(logsPanelQueryCount).toEqual(8);
    });
    test('line filter migration case sensitive', async ({ page }) => {
      // Checks chars that are escaped on-behalf of the user and chars that are user-escaped, e.g. `\n` (`%5C%5Cn`) => \n, `%5C.` (\.) => .
      const urlEncodedAndEscaped =
        '%5C%5Cnpage_url%3D%22https:%2F%2Fgrafana%5C.net%2Fexplore%5C%3Fleft%3D%5C%7B%22datasource%22:%22grafanacloud-prom%22,%22queries%22:%5C%5B%5C%7B%22datasource%22:%5C%7B%22type%22:%22prometheus%22,%22uid%22:%22grafanacloud-prom%22%5C%7D,%22expr%22:%22max%20by%20%5C%28kube_cluster_name,%20kube_namespace%5C%29%20%5C%28quantile_over_time%5C%280%5C.85,%20kubernetes_state_pod_age%5C%7Bplatform%3D%22data%22,kube_namespace%21~%22data-dev%5C%7Cdata-stg-%5C.%5C%2B%22,pod_phase%3D%22pending%22%5C%7D%5C%5B5m%5C%5D%5C%29%5C%29%20%3E%20600%22,%22refId%22:%22A%22%5C%7D%5C%5D,%22range%22:%5C%7B%22from%22:%22now-1h%22,%22to%22:%22now%22%5C%7D%5C%7D%22%60';
      const decodedAndUnescaped =
        '`\\npage_url="https://grafana.net/explore?left={"datasource":"grafanacloud-prom","queries":[{"datasource":{"type":"prometheus","uid":"grafanacloud-prom"},"expr":"max by (kube_cluster_name, kube_namespace) (quantile_over_time(0.85, kubernetes_state_pod_age{platform="data",kube_namespace!~"data-dev|data-stg-.+",pod_phase="pending"}[5m])) > 600","refId":"A"}],"range":{"from":"now-1h","to":"now"}}"`';
      await explorePage.gotoServicesOldUrlLineFilters('tempo-distributor', true, urlEncodedAndEscaped);
      const firstLineFilterLoc = page.getByTestId(testIds.exploreServiceDetails.searchLogs).first();

      await expect(firstLineFilterLoc).toHaveCount(1);
      await expect(page.getByLabel('Enable case match').nth(0)).toHaveCount(1);
      await expect(page.getByLabel('Disable case match')).toHaveCount(0);
      await expect(firstLineFilterLoc).toHaveValue(decodedAndUnescaped);
    });
    test('line filter migration case insensitive', async ({ page }) => {
      // The behavior for user entered escape chars differed between case sensitive/insensitive before the line filter regex feature, we want to preserve this bug in the migration so links from before this feature will return the same results
      const urlEncodedAndEscaped =
        '%5C%5Cnpage_url%3D%22https:%2F%2Fgrafana%5C.net%2Fexplore%5C%3Fleft%3D%5C%7B%22datasource%22:%22grafanacloud-prom%22,%22queries%22:%5C%5B%5C%7B%22datasource%22:%5C%7B%22type%22:%22prometheus%22,%22uid%22:%22grafanacloud-prom%22%5C%7D,%22expr%22:%22max%20by%20%5C%28kube_cluster_name,%20kube_namespace%5C%29%20%5C%28quantile_over_time%5C%280%5C.85,%20kubernetes_state_pod_age%5C%7Bplatform%3D%22data%22,kube_namespace%21~%22data-dev%5C%7Cdata-stg%22,pod_phase%3D%22pending%22%5C%7D%5C%5B5m%5C%5D%5C%29%5C%29%20%3E%20600%22,%22refId%22:%22A%22%5C%7D%5C%5D,%22range%22:%5C%7B%22from%22:%22now-1h%22,%22to%22:%22now%22%5C%7D%5C%7D%22%60';
      const decodedAndUnescaped =
        '\\\\npage_url="https://grafana.net/explore?left={"datasource":"grafanacloud-prom","queries":[{"datasource":{"type":"prometheus","uid":"grafanacloud-prom"},"expr":"max by (kube_cluster_name, kube_namespace) (quantile_over_time(0.85, kubernetes_state_pod_age{platform="data",kube_namespace!~"data-dev|data-stg",pod_phase="pending"}[5m])) > 600","refId":"A"}],"range":{"from":"now-1h","to":"now"}}"';
      await explorePage.gotoServicesOldUrlLineFilters('tempo-distributor', false, urlEncodedAndEscaped);
      const firstLineFilterLoc = page.getByTestId(testIds.exploreServiceDetails.searchLogs).first();

      await expect(firstLineFilterLoc).toHaveCount(1);
      await expect(page.getByLabel('Disable case match')).toHaveCount(1);
      await expect(page.getByLabel('Enable regex')).toHaveCount(1);
      await expect(firstLineFilterLoc).toHaveValue(decodedAndUnescaped);
    });
    test('line filter links', async ({ page }) => {
      explorePage.blockAllQueriesExcept({
        legendFormats: [],
        refIds: ['logsPanelQuery'],
      });

      // raw logQL query: '{cluster="us-west-1"} |~ "\\\\n" |= "\\n" |= "getBookTitles(Author.java:25)\\n" |~ "getBookTitles\\(Author\\.java:25\\)\\\\n" | json | logfmt | drop __error__, __error_details__'
      const queryInUrl =
        '{cluster=\\"us-west-1\\"} |~ \\"\\\\\\\\\\\\\\\\n\\" |= \\"\\\\\\\\n\\" |= \\"getBookTitles(Author.java:25)\\\\\\\\n\\" |~ \\"getBookTitles\\\\\\\\(Author\\\\\\\\.java:25\\\\\\\\)\\\\\\\\\\\\\\\\n\\" | json | logfmt | drop __error__, __error_details__';
      await page.goto(
        `/explore?schemaVersion=1&panes={"dx6":{"datasource":"gdev-loki","queries":[{"refId":"logsPanelQuery","expr":"${queryInUrl}","datasource":{"type":"loki","uid":"gdev-loki"}}],"range":{"from":"${STATIC_FROM}","to":"${STATIC_TO}"},"panelsState":{"logs":{"visualisationType":"logs"}}}}&orgId=1`
      );

      // 12.4 const firstExplorePanelRow = page.getByTestId('logRows').locator('.log-line-body').first();
      // Assert there are results
      const firstExplorePanelRow = page.getByTestId('logRows').locator('.log-syntax-highlight').first();
      await expect(firstExplorePanelRow).toHaveCount(1);
      await expect(firstExplorePanelRow).toBeVisible();
      const queryFieldText = await page.getByTestId('data-testid Query field').textContent();

      // Open "Go queryless" menu
      const extensionsButton = page.getByText('Go queryless');
      await expect(extensionsButton).toHaveCount(1);
      await extensionsButton.click();

      // Go to explore logs
      const openInExploreLocator = page.getByLabel('Open in Grafana Logs Drilldown').first();
      await expect(openInExploreLocator).toBeVisible();
      await openInExploreLocator.click();
      await page.getByRole('button', { exact: true, name: 'Open' }).click();

      // Assert query returned results after nav
      const firstExploreLogsRow = page
        .getByTestId(new RegExp(testIds.logsPanelHeader.header))
        .getByTestId('data-testid panel content')
        .locator('.unwrapped-log-line')
        .first();
      await expect(firstExploreLogsRow).toBeVisible();

      const lineFilters = page.getByTestId(testIds.exploreServiceDetails.searchLogs);

      // Assert the line filters have escaped the values correctly and are in the right order
      await expect(lineFilters).toHaveCount(4);
      await expect(lineFilters.nth(0)).toHaveValue('\\\\n');
      await expect(lineFilters.nth(1)).toHaveValue('\\n');
      await expect(lineFilters.nth(2)).toHaveValue('getBookTitles(Author.java:25)\\n');
      await expect(lineFilters.nth(3)).toHaveValue('getBookTitles\\(Author\\.java:25\\)\\\\n');

      // go back to explore
      await page.getByTestId(/data-testid Panel menu Logs/).click();
      await page.getByTestId('data-testid Panel menu item Explore').click();

      // Explore query should be unchanged
      expect(await page.getByTestId('data-testid Query field').textContent()).toContain(
        queryFieldText?.replace('Enter to Rename, Shift+Enter to Preview', '')
      );
    });
  });
});
