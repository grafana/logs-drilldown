import { expect, test } from '@grafana/plugin-e2e';

import { LokiQuery } from '../../src/services/lokiQuery';
import { testIds } from '../../src/services/testIds';
import { ExplorePage } from '../fixtures/explore';

import {
  expectComboboxLabel,
  getFieldBreakdownQuery,
  queriesContainBytesEqualEmptyFilter,
  setupServiceBreakdownTest,
  teardownServiceBreakdownTest,
} from './shared';

test.describe('Filters and ranges', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page, grafanaVersion }, testInfo) => {
    explorePage = await setupServiceBreakdownTest(page, grafanaVersion, testInfo);
  });

  test.afterEach(async () => {
    await teardownServiceBreakdownTest(explorePage);
  });

  test('should filter logs by bytes range', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: ['bytes', 'pod'],
    });

    // Wait for pod query to execute
    const expressions: string[] = [];
    await explorePage.waitForRequest(
      () => page.getByTestId(testIds.exploreServiceDetails.tabFields).click(),
      (q) => expressions.push(q.expr),
      (q) => q.expr.includes('pod')
    );

    expect(expressions[0].replace(/\s+/g, '')).toEqual(
      'sum by (pod) (count_over_time({service_name="tempo-distributor"} | pod!="" [$__auto]))'.replace(/\s+/g, '')
    );

    const bytesIncludeButton = page
      .getByTestId('data-testid Panel header bytes')
      .getByTestId(testIds.breakdowns.common.filterButton);
    await expect(bytesIncludeButton).toHaveText('Add to filter');

    // Show the popover
    await bytesIncludeButton.click();
    // Popover content is portaled; match the numeric filter tooltip by a unique child (not the first tooltip on the page).
    const popover = page.getByRole('tooltip').filter({
      has: page.getByTestId(testIds.breakdowns.common.filterNumericPopover.submitButton),
    });
    await expect(popover).toBeVisible();

    // Popover copy assertions
    await expectComboboxLabel(
      popover.getByTestId(testIds.breakdowns.common.filterNumericPopover.inputGreaterThanInclusive),
      'Greater than'
    );
    await expectComboboxLabel(
      popover.getByTestId(testIds.breakdowns.common.filterNumericPopover.inputLessThanInclusive),
      'Less than'
    );

    // Bytes should be default unit (B) on the unit Combobox inputs
    await expectComboboxLabel(
      popover.getByTestId(testIds.breakdowns.common.filterNumericPopover.inputGreaterThanUnit),
      'B'
    );
    await expectComboboxLabel(
      popover.getByTestId(testIds.breakdowns.common.filterNumericPopover.inputLessThanUnit),
      'B'
    );

    // Add button should be disabled
    await expect(popover.getByTestId(testIds.breakdowns.common.filterNumericPopover.submitButton)).toBeDisabled();
    await expect(popover.getByTestId(testIds.breakdowns.common.filterNumericPopover.cancelButton)).not.toBeDisabled();

    // Assert that the first input is focused
    const expectedFocusedElement = popover
      .getByTestId(testIds.breakdowns.common.filterNumericPopover.inputGreaterThan)
      .locator('input:focus');
    await expect(expectedFocusedElement).toHaveCount(1);

    // Input 100 for greater than value
    await page.keyboard.type('500');

    // Submit button should be visible now
    await expect(popover.getByTestId(testIds.breakdowns.common.filterNumericPopover.submitButton)).not.toBeDisabled();

    // input 500 for less than value
    await popover.getByTestId(testIds.breakdowns.common.filterNumericPopover.inputLessThan).click();
    await popover.getByTestId(testIds.breakdowns.common.filterNumericPopover.inputLessThan).pressSequentially('2');

    // Open unit "select"
    await popover
      .getByTestId(testIds.breakdowns.common.filterNumericPopover.inputLessThanUnit)
      .getByRole('combobox')
      .click();

    // select kilobytes (unit menu is portaled; not under the Field test id subtree)
    await page.getByRole('option', { name: 'KB', exact: true }).click();

    // Make inclusive
    await popover
      .getByTestId(testIds.breakdowns.common.filterNumericPopover.inputLessThanInclusive)
      .getByRole('combobox')
      .click();
    // Inclusive operator menu is portaled like the unit menu; options are not under the tooltip subtree.
    await page.getByRole('option', { name: 'Less than or equal', exact: true }).click();

    // Wait for pod query to execute
    const expressionsAfterNumericFilter: string[] = [];
    await explorePage.waitForRequest(
      // Add the filter
      () => popover.getByTestId(testIds.breakdowns.common.filterNumericPopover.submitButton).click(),
      (q) => expressionsAfterNumericFilter.push(q.expr),
      (q) => q.expr.includes('pod')
    );

    expect(expressionsAfterNumericFilter[0].replace(/\s+/g, '')).toEqual(
      'sum by (pod) (count_over_time({service_name="tempo-distributor"} | pod!=""     | logfmt  | bytes<=2KB | bytes>500B [$__auto]))'.replace(
        /\s+/g,
        ''
      )
    );

    // Assert that the variables were added to the UI
    await expect(page.getByText(/^bytes > 500B$/)).toHaveCount(1);
    await expect(page.getByText(/^bytes <= 2KB$/)).toHaveCount(1);

    // Assert the pod and bytes panels have data
    await expect(
      page.getByTestId('data-testid Panel header pod').getByTestId('data-testid Panel data error message')
    ).toHaveCount(0);
    await expect(
      page.getByTestId('data-testid Panel header bytes').getByTestId('data-testid Panel data error message')
    ).toHaveCount(0);

    await expect(page.getByTestId('data-testid Panel header pod')).toHaveCount(1);
    await expect(page.getByTestId('data-testid Panel header bytes')).toHaveCount(1);
  });

  test('should filter logs by int range', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: ['oldVersion', 'pod'],
    });

    // Wait for pod query to execute
    const expressions: string[] = [];
    await explorePage.waitForRequest(
      () => page.getByTestId(testIds.exploreServiceDetails.tabFields).click(),
      (q) => expressions.push(q.expr),
      (q) => q.expr.includes('pod')
    );

    expect(expressions[0].replace(/\s+/g, '')).toEqual(
      'sum by (pod) (count_over_time({service_name="tempo-distributor"} | pod!="" [$__auto]))'.replace(/\s+/g, '')
    );

    const bytesIncludeButton = page
      .getByTestId('data-testid Panel header oldVersion')
      .getByTestId(testIds.breakdowns.common.filterButton);
    await expect(bytesIncludeButton).toHaveText('Add to filter');

    // Show the popover
    await bytesIncludeButton.click();
    // Popover content is portaled; match the numeric filter tooltip by a unique child (not the first tooltip on the page).
    const popover = page.getByRole('tooltip').filter({
      has: page.getByTestId(testIds.breakdowns.common.filterNumericPopover.submitButton),
    });
    await expect(popover).toBeVisible();

    // Popover copy assertions
    await expectComboboxLabel(
      popover.getByTestId(testIds.breakdowns.common.filterNumericPopover.inputGreaterThanInclusive),
      'Greater than'
    );
    await expectComboboxLabel(
      popover.getByTestId(testIds.breakdowns.common.filterNumericPopover.inputLessThanInclusive),
      'Less than'
    );

    // Add button should be disabled
    await expect(popover.getByTestId(testIds.breakdowns.common.filterNumericPopover.submitButton)).toBeDisabled();
    await expect(popover.getByTestId(testIds.breakdowns.common.filterNumericPopover.cancelButton)).not.toBeDisabled();

    // Assert that the first input is focused
    const expectedFocusedElement = popover
      .getByTestId(testIds.breakdowns.common.filterNumericPopover.inputGreaterThan)
      .locator('input:focus');
    await expect(expectedFocusedElement).toHaveCount(1);

    // Input 2 for greater than value
    await page.keyboard.type('2');

    // Submit button should be visible now
    await expect(popover.getByTestId(testIds.breakdowns.common.filterNumericPopover.submitButton)).not.toBeDisabled();

    // input 5 for less than value
    await popover.getByTestId(testIds.breakdowns.common.filterNumericPopover.inputLessThan).click();
    await popover.getByTestId(testIds.breakdowns.common.filterNumericPopover.inputLessThan).pressSequentially('5');

    // Make inclusive
    await popover
      .getByTestId(testIds.breakdowns.common.filterNumericPopover.inputLessThanInclusive)
      .getByRole('combobox')
      .click();
    // Inclusive operator menu is portaled
    await page.getByRole('option', { name: 'Less than or equal', exact: true }).click();

    // Wait for pod query to execute
    const expressionsAfterNumericFilter: string[] = [];
    await explorePage.waitForRequest(
      // Add the filter
      () => popover.getByTestId(testIds.breakdowns.common.filterNumericPopover.submitButton).click(),
      (q) => expressionsAfterNumericFilter.push(q.expr),
      (q) => q.expr.includes('pod')
    );

    expect(expressionsAfterNumericFilter[0].replace(/\s+/g, '')).toEqual(
      'sum by (pod) (count_over_time({service_name="tempo-distributor"} | pod!=""     | logfmt  | oldVersion<=5 | oldVersion>2 [$__auto]))'.replace(
        /\s+/g,
        ''
      )
    );

    // Assert that the variables were added to the UI
    await expect(page.getByText(/^oldVersion > 2$/)).toHaveCount(1);
    await expect(page.getByText(/^oldVersion <= 5$/)).toHaveCount(1);

    // Assert the pod and bytes panels have data
    await expect(
      page.getByTestId('data-testid Panel header pod').getByTestId('data-testid Panel data error message')
    ).toHaveCount(0);
    await expect(
      page.getByTestId('data-testid Panel header oldVersion').getByTestId('data-testid Panel data error message')
    ).toHaveCount(0);

    await expect(page.getByTestId('data-testid Panel header oldVersion')).toHaveCount(1);
  });

  test('should include all logs that contain bytes field', async ({ page }) => {
    await explorePage.gotoServicesBreakdownOldUrl('tempo-distributor');
    let numberOfQueries = 0;
    // Let's not wait for all these queries
    await page.route('**/ds/query*', async (route) => {
      const post = route.request().postDataJSON();
      const queries = post.queries as LokiQuery[];

      if (queries.some((q) => q.refId === 'logsPanelQuery')) {
        await route.continue();
      } else {
        await route.fulfill({ json: [] });
      }
    });
    // Click on the fields tab
    await explorePage.goToFieldsTab();
    // Selector
    const bytesPanelHeader = page.getByTestId('data-testid Panel header bytes');
    const bytesIncludeButton = bytesPanelHeader.getByTestId(testIds.breakdowns.common.filterButtonGroup);

    // Wait for the bytes panel itself, then for its filter button group to
    // render. The filter button group only renders after `calculateSparsity`
    // runs against logs panel data, and under parallel load the logs panel
    // query (which we deliberately let through) lags behind the intercepted
    // field panel responses, so a naive `Panel loading bar` wait can race.
    await expect(bytesPanelHeader).toBeVisible();
    await expect(bytesIncludeButton).toBeVisible();
    await expect(page.getByLabel('Panel loading bar')).toHaveCount(0);

    await expect(bytesIncludeButton.getByTestId(testIds.breakdowns.common.filterSelect)).toHaveCount(1);

    // Now we'll intercept any further queries, note that the intercept above is still-preventing the actual request so the panels will return with no-data instantly
    await page.route('**/ds/query*', async (route) => {
      const post = route.request().postDataJSON();
      const queries = post.queries as LokiQuery[];
      const bytesQuery = getFieldBreakdownQuery(queries, 'bytes');
      if (!bytesQuery?.expr.includes('bytes!=""')) {
        await route.fulfill({ json: [] });
        return;
      }
      numberOfQueries++;

      await route.fulfill({ json: [] });
    });

    // Include
    await bytesIncludeButton.getByTestId(testIds.breakdowns.common.filterSelect).click();
    await page.getByRole('menuitemradio', { name: /Include/ }).click();

    // Assert the panel is still there
    expect(page.getByTestId('data-testid Panel header bytes')).toBeDefined();

    // Assert that the button state is now "include"
    await expect(bytesIncludeButton).toHaveText('Include');

    // Assert that we actually ran some queries
    await expect.poll(() => numberOfQueries).toBeGreaterThan(0);
  });

  test('should exclude all logs that contain bytes field', async ({ page }) => {
    await explorePage.gotoServicesBreakdownOldUrl('tempo-distributor');
    let numberOfQueries = 0;
    // Let's not wait for all these queries
    await page.route('**/ds/query*', async (route) => {
      const post = route.request().postDataJSON();
      const queries = post.queries as LokiQuery[];

      if (queries.some((q) => q.refId === 'logsPanelQuery')) {
        await route.continue();
      } else {
        await route.fulfill({ json: [] });
      }
    });
    // Click on the fields tab
    await explorePage.goToFieldsTab();
    const bytesPanelHeader = page.getByTestId('data-testid Panel header bytes');
    const bytesIncludeButton = bytesPanelHeader.getByTestId(testIds.breakdowns.common.filterButtonGroup);

    // Match include test: filter dropdown only appears after sparsity + logs data settle.
    await expect(bytesPanelHeader).toBeVisible({ timeout: 45000 });
    await expect(bytesIncludeButton).toBeVisible();
    await expect(page.getByLabel('Panel loading bar')).toHaveCount(0);

    await expect(bytesIncludeButton.getByTestId(testIds.breakdowns.common.filterSelect)).toHaveCount(1, {
      timeout: 45000,
    });

    // Now we'll intercept any further queries, note that the intercept above is still-preventing the actual request so the panels will return with no-data instantly
    await page.route('**/ds/query*', async (route) => {
      const post = route.request().postDataJSON();
      const queries = post.queries as LokiQuery[];
      // After Exclude, the bytes breakdown panel is removed — batches often no longer include refId `bytes`.
      // The sparse filter still appears on other queries (e.g. logs) that share VAR_FIELDS_EXPR.
      if (!queriesContainBytesEqualEmptyFilter(queries)) {
        await route.fulfill({ json: [] });
        return;
      }
      numberOfQueries++;

      await route.fulfill({ json: [] });
    });

    // Open the dropdown and change from include to exclude
    await expect
      .poll(
        async () => {
          await bytesIncludeButton.getByTestId(testIds.breakdowns.common.filterSelect).click();
          return await page.getByRole('menuitemradio', { name: /Exclude/ }).count();
        },
        { message: 'attempt to open panel filter dropdown', timeout: 0 }
      )
      .toBe(1);

    await page.getByRole('menuitemradio', { name: /Exclude/ }).click();

    // Assert that the panel is no longer rendered
    await expect(bytesIncludeButton).not.toBeInViewport();
    // Assert that the viz was excluded
    await expect(page.getByTestId('data-testid Panel header bytes')).toHaveCount(0);
    // Assert that we actually had some queries
    expect(numberOfQueries).toBeGreaterThan(0);
  });
});
