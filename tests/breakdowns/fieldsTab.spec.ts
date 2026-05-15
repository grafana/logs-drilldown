import { expect, test } from '@grafana/plugin-e2e';

import { FilterOp } from '../../src/services/filterTypes';
import { LokiQuery } from '../../src/services/lokiQuery';
import { testIds } from '../../src/services/testIds';
import { ComboBoxIndex, E2EComboboxStrings, ExplorePage, PlaywrightRequest } from '../fixtures/explore';
import { mockEmptyQueryApiResponse } from '../mocks/mockEmptyQueryApiResponse';

import {
  fieldName,
  labelName,
  levelName,
  metadataName,
  setupServiceBreakdownTest,
  teardownServiceBreakdownTest,
} from './shared';

test.describe('Fields tab', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page, grafanaVersion }, testInfo) => {
    explorePage = await setupServiceBreakdownTest(page, grafanaVersion, testInfo);
  });

  test.afterEach(async () => {
    await teardownServiceBreakdownTest(explorePage);
  });

  test('should show warning when partial results are returned', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: ['ts'],
    });
    await explorePage.goToFieldsTab();
    await expect(
      page.getByTestId('data-testid Panel header ts').getByTestId('data-testid Panel status error')
    ).toBeVisible();
    await page.getByRole('link', { name: 'Select ts' }).click();
    await expect(page.getByTestId('data-testid Panel status error')).toBeVisible();
  });

  test('should search for tenant field, changing sort order updates value breakdown position', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      legendFormats: [`{{${levelName}}}`],
      refIds: ['logsPanelQuery'],
    });
    await explorePage.goToFieldsTab();

    // Use the dropdown since the tenant field might not be visible
    await page.getByTestId(testIds.breakdowns.labelFieldSearch).click();
    await page.keyboard.type('tenan');
    await page.getByRole('option', { name: 'tenant', exact: true }).click();

    // Assert loading is done and panels are showing
    const panels = page.getByTestId(/data-testid Panel header/);
    await expect(panels.first()).toBeVisible({ timeout: 45000 });
    // Wait for panels to settle so we don't race with a re-render. The
    // static snapshot can have anywhere from 1 (parent-only) to N value
    // breakdown panels for `tenant`, so we don't assert a specific count
    // here; assertPanelsNotLoading is enough to know the value-breakdown
    // query has resolved.
    await explorePage.assertPanelsNotLoading();
    await expect
      .poll(() => page.evaluate(() => document.querySelectorAll('[data-testid^="data-testid Panel header"]').length), {
        timeout: 45000,
      })
      .toBeGreaterThan(0);
    // Read all panel titles atomically in the page so we don't race with
    // a re-render between Playwright locator queries (which was the cause
    // of `panels.nth(1).getByRole('heading')` timing out under parallel).
    const panelTitles = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll('[data-testid^="data-testid Panel header"]'));
      return headers.map((h) => h.querySelector('h1,h2,h3,h4')?.textContent ?? null);
    });

    expect(panelTitles.length).toBeGreaterThan(0);

    const readPanelTitles = () =>
      page.evaluate(() => {
        const headers = Array.from(document.querySelectorAll('[data-testid^="data-testid Panel header"]'));
        return headers.map((h) => h.querySelector('h1,h2,h3,h4')?.textContent ?? null);
      });

    await page.getByTestId(testIds.breakdowns.common.sortByDirection).click();
    // Desc is the default option, this should be a noop
    await page.getByRole('option', { name: 'Desc' }).click();

    await expect(panels.first()).toBeVisible();
    await explorePage.assertPanelsNotLoading();
    // assert the sort order hasn't changed
    await expect.poll(readPanelTitles).toEqual(panelTitles);

    await page.getByTestId(testIds.breakdowns.common.sortByDirection).click();
    // Now change the sort order
    await page.getByRole('option', { name: 'Asc' }).click();

    await expect(panels.first()).toBeVisible();
    await explorePage.assertPanelsNotLoading();
    // assert the sort order is now reversed
    await expect.poll(readPanelTitles).toEqual([...panelTitles].reverse());
  });
  test(`should search fields for ${fieldName}`, async ({ page }) => {
    await explorePage.goToFieldsTab();
    await explorePage.click(page.getByLabel(`Select ${fieldName}`));
    await explorePage.click(page.getByPlaceholder('Search for value'));
    const panels = page.getByTestId(/data-testid Panel header/);
    await expect(panels.first()).toBeVisible();
    // Assert there is at least 2 panels
    await expect(panels.nth(1)).toBeVisible();
    // expect(await panels.count()).toBeGreaterThan(1);
    await page.keyboard.type('brod');
    await expect(panels).toHaveCount(2);
  });

  test(`should exclude ${fieldName}, request should contain logfmt`, async ({ page }) => {
    let requests: PlaywrightRequest[] = [];
    explorePage.blockAllQueriesExcept({
      refIds: [fieldName],
      requests,
    });

    await explorePage.goToFieldsTab();

    const allPanels = explorePage.getAllPanelsLocator();
    await page.getByLabel(`Select ${fieldName}`).click();

    // Should see 8 panels after it's done loading
    await expect(allPanels).toHaveCount(9);
    // And we'll have 2 requests, one on the aggregation, one for the label values
    await expect.poll(() => requests).toHaveLength(2);

    const excludeButton = page.getByRole('button', { name: 'Exclude' }).nth(0);

    // This should trigger more queries
    await excludeButton.click();
    // Should have excluded a panel
    await expect(excludeButton).toHaveAttribute('aria-selected', 'true');

    // Adhoc content filter should be added
    await expect(page.getByLabel(E2EComboboxStrings.editByKey(fieldName))).toBeVisible();
    await expect(page.getByText('!=')).toBeVisible();

    await expect.poll(() => requests).toHaveLength(2);

    requests.forEach((req) => {
      const post = req.post;
      const queries: LokiQuery[] = post.queries;
      queries.forEach((query) => {
        expect(query.expr).toContain('| logfmt | caller!=""');
      });
    });
  });

  test(`should include field ${fieldName}, update filters, open filters breakdown`, async ({ page }) => {
    await explorePage.goToFieldsTab();
    await explorePage.scrollToBottom();
    await page.getByLabel(`Select ${fieldName}`).click();
    await page.getByRole('button', { name: 'Include' }).nth(0).click();
    await expect(page.getByLabel(E2EComboboxStrings.editByKey(fieldName))).toBeVisible();
    await expect(page.getByText('=').nth(1)).toBeVisible();
  });

  test(`Fields: can regex include ${fieldName} values containing "st"`, async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: [fieldName],
    });
    await explorePage.goToFieldsTab();

    // Go to caller values breakdown
    await page.getByLabel(`Select ${fieldName}`).click();
    const panels = explorePage.getAllPanelsLocator();
    await expect(panels).toHaveCount(9);
    // Add custom regex value
    await explorePage.addCustomValueToCombobox(fieldName, FilterOp.RegexEqual, ComboBoxIndex.fields, `.+st.+`, 'ca');

    await expect(page.getByLabel(E2EComboboxStrings.editByKey(fieldName))).toBeVisible();
    await expect(page.getByText('=~')).toBeVisible();

    // Filter will not change output
    await expect(panels).toHaveCount(9);
    await expect(
      page.getByTestId(/data-testid Panel header .+st.+/).locator(explorePage.getPanelHeaderLocator())
    ).toHaveCount(3);

    await explorePage.goToFieldsTab();
    // Verify that the regex query worked after navigating back to the label breakdown
    await expect(page.getByTestId(/data-testid VizLegend series/)).toHaveCount(3);
  });

  test(`Levels: include ${levelName} values`, async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      legendFormats: [`{{${levelName}}}`],
    });
    await explorePage.goToLabelsTab();

    // Go to caller values breakdown
    await page.getByLabel(`Select ${levelName}`).click();

    // Open levels combobox
    const comboboxLocator = page.getByTestId(testIds.variables.levels.inputWrap).getByRole('combobox');
    await comboboxLocator.click();

    // Select debug|error
    await page.getByRole('option', { name: 'debug' }).click();
    await page.getByRole('option', { name: 'error' }).click();
    await page.keyboard.press('Escape');

    const panels = explorePage.getAllPanelsLocator();
    await expect(panels).toHaveCount(5);
    await expect(
      page.getByTestId(/data-testid Panel header debug|error/).locator(explorePage.getPanelHeaderLocator())
    ).toHaveCount(2);
  });

  test(`Metadata: can regex include ${metadataName} values containing "0\\d"`, async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: [metadataName],
    });

    await explorePage.goToFieldsTab();

    // Go to caller values breakdown
    await page.getByLabel(`Select ${metadataName}`).click();

    // Filter by cluster
    await explorePage.addCustomValueToCombobox(
      'cluster',
      FilterOp.RegexEqual,
      ComboBoxIndex.labels,
      `.+east-1$`,
      'clust'
    );
    // Add both tempo services
    await explorePage.addCustomValueToCombobox(
      'service_name',
      FilterOp.RegexEqual,
      ComboBoxIndex.labels,
      `tempo.+`,
      'service'
    );
    await explorePage.addCustomValueToCombobox(
      'namespace',
      FilterOp.RegexEqual,
      ComboBoxIndex.labels,
      `.+dev.*`,
      'name'
    );
    // Remove tempo-distributor
    await page.getByLabel('Remove filter with key').first().click();

    // Get panel count to ensure the pod regex filter reduces the result set
    await explorePage.assertPanelsNotLoading();

    // Pods have a variable count!
    await expect.poll(() => explorePage.getAllPanelsLocator().count()).toBeGreaterThanOrEqual(10);
    // Filter hardcoded pod names for tempo-ingester service
    await explorePage.addCustomValueToCombobox(
      metadataName,
      FilterOp.RegexEqual,
      ComboBoxIndex.fields,
      `tempo-ingester-[hc]{2}-\\d.+`
    );

    await expect(page.getByLabel(E2EComboboxStrings.editByKey(metadataName))).toBeVisible();
    await expect(page.getByText('=~').nth(3)).toBeVisible();
    await explorePage.assertPanelsNotLoading();
    await expect
      .poll(() =>
        page
          .getByTestId(/data-testid Panel header tempo-ingester-[hc]{2}-\d.+/)
          .locator(explorePage.getPanelHeaderLocator())
          .count()
      )
      .toBe(8);
    await explorePage.goToFieldsTab();
    // Verify that the regex query worked after navigating back to the label breakdown
    await expect.poll(() => page.getByTestId(/data-testid VizLegend series/).count()).toBe(8);
  });

  test('should only load fields that are in the viewport', async ({ page }) => {
    await explorePage.setDefaultViewportSize();
    let requestCount = 0,
      logsCountQueryCount = 0;

    // We don't need to mock the response, but it speeds up the test
    await page.route('**/api/ds/query*', async (route, request) => {
      const mockResponse = mockEmptyQueryApiResponse;
      const rawPostData = request.postData();

      // We only want to mock the actual field requests, and not the initial request that returns us our list of fields
      if (rawPostData) {
        const postData = JSON.parse(rawPostData);
        const refId = postData.queries[0].refId;
        // Field subqueries have a refId of the field name
        if (refId !== 'logsPanelQuery' && refId !== 'A' && refId !== 'logsCountQuery') {
          requestCount++;
          // simulate the query taking some time
          return await route.fulfill({ json: mockResponse });
        }
        if (refId === 'logsCountQuery') {
          logsCountQueryCount++;
        }
      }

      // Otherwise let the request go through normally
      const response = await route.fetch();
      const json = await response.json();
      return route.fulfill({ json, response });
    });
    // Navigate to fields tab
    await explorePage.goToFieldsTab();
    // Make sure the panels have started to render
    await expect(page.getByTestId(/data-testid Panel header/).first()).toBeInViewport();

    // Assert the container size of the plugin hasn't changed, or that will mess with the assumptions below
    const pageContainerSize = await page.locator('#pageContent').boundingBox();
    expect(pageContainerSize.width).toEqual(1280);
    expect(pageContainerSize.height).toBeGreaterThanOrEqual(632);

    const INITIAL_ROWS = 2;
    const COUNT_PER_ROW = 3;
    const TOTAL_ROWS = 7;

    // Fields on top should be loaded
    expect.poll(() => requestCount).toEqual(INITIAL_ROWS * COUNT_PER_ROW);
    expect.poll(() => logsCountQueryCount).toEqual(2);

    await explorePage.scrollToBottom();
    // Panel on the bottom should be visible
    await expect(page.getByTestId(/data-testid Panel header/).last()).toBeInViewport();
    // Panel on the top should not
    await expect(page.getByTestId(/data-testid Panel header/).first()).not.toBeInViewport();
    // Adding a bit of slop here, sometimes detected_fields misses a low cardinality field
    await expect.poll(() => requestCount).toBeGreaterThanOrEqual(TOTAL_ROWS * COUNT_PER_ROW - 1 - 2);
    await expect.poll(() => requestCount).toBeLessThanOrEqual(TOTAL_ROWS * COUNT_PER_ROW - 1);
    await expect.poll(() => logsCountQueryCount).toEqual(2);
  });

  test('Patterns should show error state when API call returns error', async ({ page }) => {
    // Block everything to speed up the test
    explorePage.blockAllQueriesExcept({
      refIds: ['C'],
    });

    await page.route('**/resources/patterns**', async (route) => {
      await route.fulfill({
        body: '{"message":"","traceID":"abc123"}',
        contentType: 'text/plain',
        status: 404,
      });
    });
    await page.getByTestId(testIds.exploreServiceDetails.tabPatterns).click();
    await expect(page.getByText('Pattern matching has not been configured.')).toBeVisible();
  });

  test(`should select field ${fieldName}, update filters, open log panel`, async ({ page }) => {
    await explorePage.goToFieldsTab();
    await page.getByLabel(`Select ${fieldName}`).click();
    await page.getByRole('button', { name: 'Include' }).nth(0).click();
    // Adhoc content filter should be added
    await expect(page.getByLabel(E2EComboboxStrings.editByKey(fieldName))).toBeVisible();
  });
});
