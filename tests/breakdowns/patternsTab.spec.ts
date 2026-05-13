import { expect, test } from '@grafana/plugin-e2e';

import { testIds } from '../../src/services/testIds';
import { ExplorePage, E2EComboboxStrings } from '../fixtures/explore';

import { fieldName, setupServiceBreakdownTest, teardownServiceBreakdownTest } from './shared';

test.describe('Patterns tab', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page, grafanaVersion }, testInfo) => {
    explorePage = await setupServiceBreakdownTest(page, grafanaVersion, testInfo);
  });

  test.afterEach(async () => {
    await teardownServiceBreakdownTest(explorePage);
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

  test('should show sample table on `<_>` click in patterns', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: ['A'],
    });
    await page.getByTestId(testIds.exploreServiceDetails.tabPatterns).click();
    await page.getByText('<_>').last().click();
    // `From a sample of` is the indicator that the underlying query perfomed successfully
    await expect(page.getByText(`From a sample of`)).toBeVisible();
  });

  test('should filter patterns in table on legend click', async ({ page }) => {
    await page.getByTestId(testIds.exploreServiceDetails.tabPatterns).click();
    const row = page.getByTestId(testIds.patterns.tableWrapper).getByRole('table').getByRole('row');
    await expect(explorePage.getPanelContentLocator().getByRole('button').nth(1)).toBeVisible();
    expect(await row.count()).toBeGreaterThan(2);
    await explorePage.getPanelContentLocator().getByRole('button').nth(1).click();
    expect(await row.count()).toEqual(2);
  });

  test('should search patterns by text', async ({ page }) => {
    await page.getByTestId(testIds.exploreServiceDetails.tabPatterns).click();

    // Get the cell within the second row
    const patternTextCell = page
      .getByTestId(testIds.patterns.tableWrapper)
      .getByRole('table')
      .getByRole('row')
      .nth(2)
      .getByRole('cell')
      .nth(5);

    // Assert the target row is visible
    await expect(patternTextCell).toBeVisible();

    // Count all of the rows in the table before filtering
    const countOfAllRows = await page
      .getByTestId(testIds.patterns.tableWrapper)
      .getByRole('table')
      .getByRole('row')
      .count();

    // Get the full pattern from the cell
    const searchText = (await patternTextCell.textContent()) as string;
    expect(searchText).not.toBeUndefined();

    // Get the input
    const patternSearchInput = page.getByPlaceholder('Search patterns');

    // Set the content
    await patternSearchInput.fill(searchText);

    // Expect input is visible
    await expect(patternSearchInput).toBeVisible();

    // Get the first row after filtering
    const patternTextCellAfterFilter = page
      .getByTestId(testIds.patterns.tableWrapper)
      .getByRole('table')
      .getByRole('row')
      // First row is header?
      .nth(1)
      .getByRole('cell')
      .nth(3);

    // Assert that the visible row has the desired search string
    await expect(patternTextCellAfterFilter).toBeVisible();
    expect(await patternTextCellAfterFilter.textContent()).toBeDefined();

    // Count the rows after filtering
    const countOfAllRowsAfterFilter =
      (await page
        .getByTestId(testIds.patterns.tableWrapper)
        .getByRole('table')
        .getByRole('row')
        // Header takes up a row
        .count()) - 1;

    // Assert count should always be 1 unless one pattern contains another
    expect(countOfAllRowsAfterFilter).toBeGreaterThanOrEqual(1);
    expect(countOfAllRows).toBeGreaterThan(countOfAllRowsAfterFilter);

    // Assert the viz was filtered as well. The viz is a separate scene that
    // re-renders asynchronously after the search input is debounced; under
    // parallel E2E load this can take a while, so use a generous timeout and
    // wait for the count to settle to the expected value.
    await expect
      .poll(() => page.getByTestId('series-icon').count(), { timeout: 60000 })
      .toBe(countOfAllRowsAfterFilter);
  });

  test('should select an include pattern field in default single view, update filters, not open log panel', async ({
    page,
  }) => {
    await page.getByTestId(testIds.exploreServiceDetails.tabPatterns).click();

    // Include pattern
    const firstIncludeButton = page
      .getByTestId(testIds.patterns.tableWrapper)
      .getByRole('table')
      .getByRole('row')
      .nth(2)
      .getByTestId(testIds.exploreServiceDetails.buttonFilterInclude);

    await expect(firstIncludeButton).toHaveCount(1);
    //Flake (M)
    await firstIncludeButton.click();
    // Should not open logs panel and should stay in patterns tab as we allow multiple  patterns
    await expect(page.getByTestId(testIds.logsPanelHeader.header)).not.toBeVisible();
    await expect(page.getByTestId(testIds.patterns.tableWrapper)).toBeVisible();
    // Pattern filter should be added
    await expect(page.getByTestId(testIds.patterns.buttonIncludedPattern)).toBeVisible();
  });

  test('Should add multiple exclude patterns, which are replaced by include pattern', async ({ page }) => {
    await page.getByTestId(testIds.exploreServiceDetails.tabPatterns).click();

    const firstIncludeButton = page
      .getByTestId(testIds.patterns.tableWrapper)
      .getByRole('table')
      .getByRole('row')
      .nth(2)
      .getByTestId(testIds.exploreServiceDetails.buttonFilterInclude);
    const firstExcludeButton = page
      .getByTestId(testIds.patterns.tableWrapper)
      .getByRole('table')
      .getByRole('row')
      .nth(2)
      .getByTestId(testIds.exploreServiceDetails.buttonFilterExclude);

    await expect(firstIncludeButton).toBeVisible();
    await expect(firstExcludeButton).toBeVisible();

    // Include pattern
    await firstExcludeButton.click();

    // Both buttons should be visible
    await expect(firstIncludeButton).toBeVisible();
    await expect(firstExcludeButton).toBeVisible();

    const secondExcludeButton = page
      .getByTestId(testIds.patterns.tableWrapper)
      .getByRole('table')
      .getByRole('row')
      .nth(3)
      .getByTestId(testIds.exploreServiceDetails.buttonFilterExclude);
    await secondExcludeButton.click();

    // Both exclude patterns should be visible
    await expect(page.getByTestId(testIds.patterns.buttonIncludedPattern)).not.toBeVisible();
    await expect(page.getByTestId(testIds.patterns.buttonExcludedPattern)).toBeVisible();

    await expect(firstIncludeButton).toHaveCount(1);
    await firstIncludeButton.click();
    // Include and exclude patterns should be visible
    await expect(page.getByTestId(testIds.patterns.buttonIncludedPattern)).toBeVisible();
    await expect(page.getByTestId(testIds.patterns.buttonExcludedPattern)).toBeVisible();
  });

  test('Should add multiple include patterns', async ({ page }) => {
    await page.getByTestId(testIds.exploreServiceDetails.tabPatterns).click();

    const firstIncludeButton = page
      .getByTestId(testIds.patterns.tableWrapper)
      .getByRole('table')
      .getByRole('row')
      .nth(2)
      .getByTestId(testIds.exploreServiceDetails.buttonFilterInclude);
    const secondIncludeButton = page
      .getByTestId(testIds.patterns.tableWrapper)
      .getByRole('table')
      .getByRole('row')
      .nth(3)
      .getByTestId(testIds.exploreServiceDetails.buttonFilterInclude);

    await expect(firstIncludeButton).toBeVisible();
    await expect(secondIncludeButton).toBeVisible();

    // Include pattern
    await firstIncludeButton.click();

    // Both buttons should be visible
    await expect(firstIncludeButton).toBeVisible();
    await expect(secondIncludeButton).toBeVisible();

    await secondIncludeButton.click();

    // Both include patterns should be visible
    await expect(page.getByTestId(testIds.patterns.buttonIncludedPattern)).toBeVisible();
    await expect(page.getByTestId(testIds.exploreServiceDetails.buttonRemovePattern).nth(0)).toBeVisible();
    await expect(page.getByTestId(testIds.exploreServiceDetails.buttonRemovePattern).nth(1)).toBeVisible();
  });

  test('Should filter patterns by level', async ({ page }) => {
    await explorePage.goToPatternsTab();

    const rows = page.getByTestId('data-testid table-wrapper').locator('[role="rowgroup"] [role="row"]');

    // Get total count of rows once the table has settled
    await expect(rows.first()).toBeVisible();
    const unfilteredRowsCount = await rows.count();
    expect(unfilteredRowsCount).toBeGreaterThan(1);

    // Click on level within table to filter to debug only — wait for the table to converge to 1 row
    await page.getByTestId('data-testid table-wrapper').getByRole('button', { name: 'debug' }).click();
    await expect(rows).toHaveCount(1);

    // remove level filter from variable
    await page
      .getByTestId('data-testid detected_level filter variable')
      .getByRole('button', { name: 'Remove' })
      .click();

    // Wait for the patterns query to refire and the table to return to its full size
    await expect(rows).toHaveCount(unfilteredRowsCount);
  });
  test('Should only call patterns API once on time range change', async ({ page }) => {
    let patternsCount = 0;
    await page.route('**/patterns?**', async (route, request) => {
      patternsCount++;
      // Let the request go through normally
      const response = await route.fetch();
      const json = await response.json();
      return route.fulfill({ json, response });
    });

    await expect.poll(() => patternsCount).toEqual(1);
    await explorePage.goToPatternsTab();
    await expect.poll(() => patternsCount).toEqual(2);
    await page.getByTestId('data-testid RefreshPicker run button').click();
    await explorePage.assertTabsNotLoading();
    await expect.poll(() => patternsCount).toEqual(3);
  });
});
