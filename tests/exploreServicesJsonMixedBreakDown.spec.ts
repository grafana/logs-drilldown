import { expect, test } from '@grafana/plugin-e2e';

import { LokiQuery } from '../src/services/lokiQuery';
import { E2EComboboxStrings, ExplorePage, PlaywrightRequest } from './fixtures/explore';

const mixedFieldName = 'method';
const logFmtFieldName = 'caller';
const jsonFmtFieldName = 'status';
const metadataFieldName = 'pod';
const serviceName = 'nginx-json-mixed';
// const levelName = 'cluster'
test.describe('explore nginx-json-mixed breakdown pages ', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page }, testInfo) => {
    explorePage = new ExplorePage(page, testInfo);
    await explorePage.setExtraTallViewportSize();
    await explorePage.clearLocalStorage();
    await explorePage.gotoServicesBreakdownOldUrl(serviceName);
  });

  test.afterEach(async ({ page }) => {
    await explorePage.unroute();
    explorePage.echoConsoleLogsOnRetry();
  });

  test(`should exclude ${mixedFieldName}, request should contain both parsers`, async ({ page }) => {
    let requests: PlaywrightRequest[] = [];
    explorePage.blockAllQueriesExcept({
      refIds: [new RegExp(`^${mixedFieldName}$`)],
      requests,
    });
    // First request should fire here
    await explorePage.goToFieldsTab();

    await page.getByLabel(`Select ${mixedFieldName}`).click();
    const allPanels = explorePage.getAllPanelsLocator();
    // We should have 6 panels
    await expect(allPanels).toHaveCount(7);
    // Should have 2 queries by now
    await expect.poll(() => requests).toHaveLength(2);
    // Exclude a panel
    await page.getByRole('button', { name: 'Exclude' }).nth(0).click();
    // Should NOT be removed from the UI
    await expect(allPanels).toHaveCount(7);

    // Adhoc content filter should be added
    await expect(page.getByLabel(E2EComboboxStrings.editByKey(mixedFieldName))).toBeVisible();
    await expect(page.getByText('!=')).toBeVisible();

    await expect.poll(() => requests).toHaveLength(2);

    requests.forEach((req) => {
      const post = req.post;
      const queries: LokiQuery[] = post.queries;
      queries.forEach((query) => {
        expect(query.expr.replace(/\s+/g, '')).toContain(
          `sum by (${mixedFieldName}) (count_over_time({service_name="${serviceName}"}      | json method="[\\"method\\"]" | logfmt | drop __error__, __error_details__ | ${mixedFieldName}!=""`.replace(
            /\s+/g,
            ''
          )
        );
      });
    });
  });
  test(`should exclude ${logFmtFieldName}, request should contain logfmt`, async ({ page }) => {
    let requests: PlaywrightRequest[] = [];
    explorePage.blockAllQueriesExcept({
      refIds: [new RegExp(`^${logFmtFieldName}$`)],
      requests,
    });

    // First request should fire here
    await explorePage.goToFieldsTab();
    const allPanels = explorePage.getAllPanelsLocator();

    // Should be at least 20 fields coming back from the detected_fields, but one is detected_level
    await expect.poll(() => allPanels.count()).toBeGreaterThanOrEqual(20);

    await page.getByLabel(`Select ${logFmtFieldName}`).click();

    // We should have 2 panels for 1 field value
    await expect(allPanels).toHaveCount(2);
    // Should have 2 queries by now
    expect(requests).toHaveLength(2);
    // Exclude a panel
    await page.getByRole('button', { name: 'Exclude' }).nth(0).click();
    // Nav to fields index
    await explorePage.goToFieldsTab();
    // There is only one panel/value, so we should be redirected back to the aggregation after excluding it
    await expect.poll(() => allPanels.count()).toBeGreaterThanOrEqual(19);

    // Adhoc content filter should be added
    await expect(page.getByLabel(E2EComboboxStrings.editByKey(logFmtFieldName))).toBeVisible();
    await expect(page.getByText('!=')).toBeVisible();
    await expect.poll(() => requests.length).toBeGreaterThanOrEqual(2);

    // Aggregation query, no filter
    expect(requests[0]?.post?.queries[0]?.expr.replace(/\s+/g, '')).toEqual(
      `sum by (${logFmtFieldName}) (count_over_time({service_name="${serviceName}"}      | logfmt | ${logFmtFieldName}!=""  [$__auto]))`.replace(
        /\s+/g,
        ''
      )
    );
    // Value breakdown query, with/without filter
    expect(requests[1]?.post?.queries[0]?.expr.replace(/\s+/g, '')).toEqual(
      `sum by (${logFmtFieldName}) (count_over_time({service_name="${serviceName}"}      | logfmt | ${logFmtFieldName}!=""  [$__auto]))`.replace(
        /\s+/g,
        ''
      )
    );
    if (requests.length === 3) {
      console.log('DEBUG: unexpected third request', requests[1]?.post?.queries[0]?.expr);
    }
  });
  test(`should exclude ${jsonFmtFieldName}, request should contain logfmt`, async ({ page }) => {
    let requests: PlaywrightRequest[] = [];
    explorePage.blockAllQueriesExcept({
      refIds: [jsonFmtFieldName],
      requests,
    });
    // First request should fire here
    await explorePage.goToFieldsTab();

    await page.getByLabel(`Select ${jsonFmtFieldName}`).click();
    const allPanels = explorePage.getAllPanelsLocator();
    // We should have 4 panels
    await expect(allPanels).toHaveCount(4);
    // Should have 2 queries by now
    expect(requests).toHaveLength(2);
    // Exclude a panel
    await page.getByRole('button', { name: 'Exclude' }).nth(0).click();
    // Should NOT be removed from the UI, and also lets us know when the query is done loading
    await expect(allPanels).toHaveCount(4);

    // Adhoc content filter should be added
    await expect(page.getByLabel(E2EComboboxStrings.editByKey(jsonFmtFieldName))).toBeVisible();
    await expect(page.getByText('!=')).toBeVisible();

    await expect.poll(() => requests).toHaveLength(2);

    requests.forEach((req) => {
      const post = req.post;
      const queries: LokiQuery[] = post.queries;
      queries.forEach((query) => {
        expect(query.expr.replace(/\s+/g, '')).toContain(
          `sum by (${jsonFmtFieldName}) (count_over_time({service_name="${serviceName}"} | json status="[\\"status\\"]" | drop __error__, __error_details__ | ${jsonFmtFieldName}!=""`.replace(
            /\s+/g,
            ''
          )
        );
      });
    });
  });
  test(`should exclude ${metadataFieldName}, request should contain no parser`, async ({ page }) => {
    let requests: PlaywrightRequest[] = [];
    explorePage.blockAllQueriesExcept({
      refIds: [metadataFieldName],
      requests,
    });
    // First request should fire here
    await explorePage.goToFieldsTab();

    await page.getByLabel(`Select ${metadataFieldName}`).click();
    const allPanels = explorePage.getAllPanelsLocator();
    // We should have more than 1 panels
    await expect.poll(() => allPanels.count()).toBeGreaterThanOrEqual(4);
    const actualCount = await allPanels.count();
    // Should have 2 queries by now
    expect(requests).toHaveLength(2);
    // Exclude a panel
    await page.getByRole('button', { name: 'Exclude' }).nth(0).click();
    await expect.poll(() => allPanels.count()).toBeGreaterThanOrEqual(actualCount - 1);

    // Adhoc content filter should be added
    await expect(page.getByLabel(E2EComboboxStrings.editByKey(metadataFieldName))).toBeVisible();
    await expect(page.getByText('!=')).toBeVisible();

    await expect.poll(() => requests).toHaveLength(2);

    requests.forEach((req) => {
      const post = req.post;
      const queries: LokiQuery[] = post.queries;
      queries.forEach((query) => {
        expect(query.expr.replace(/\s+/g, '')).toContain(
          `sum by (${metadataFieldName}) (count_over_time({service_name="${serviceName}"} | ${metadataFieldName}!=""`.replace(
            /\s+/g,
            ''
          )
        );
      });
    });
  });
});
