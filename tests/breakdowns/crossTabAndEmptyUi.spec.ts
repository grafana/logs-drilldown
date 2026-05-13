import { expect, test } from '@grafana/plugin-e2e';

import { FilterOp } from '../../src/services/filterTypes';
import { LokiQueryDirection } from '../../src/services/lokiQuery';
import { testIds } from '../../src/services/testIds';
import { STATIC_FROM, STATIC_TO } from '../config/constants';
import { ComboBoxIndex, E2EComboboxStrings, ExplorePage } from '../fixtures/explore';

import {
  fieldName,
  labelName,
  levelName,
  metadataName,
  setupServiceBreakdownTest,
  teardownServiceBreakdownTest,
} from './shared';

test.describe('Cross-tab and empty UI', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page, grafanaVersion }, testInfo) => {
    explorePage = await setupServiceBreakdownTest(page, grafanaVersion, testInfo);
  });

  test.afterEach(async () => {
    await teardownServiceBreakdownTest(explorePage);
  });

  test('should see empty labels UI', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      legendFormats: [`{{${labelName}}}`],
    });
    await page.goto(
      `/a/grafana-lokiexplore-app/explore/service/nginx/labels?var-ds=gdev-loki&from=${encodeURIComponent(STATIC_FROM)}&to=${encodeURIComponent(STATIC_TO)}&patterns=%5B%5D&var-fields=&var-levels=&var-patterns=&var-lineFilter=&var-filters=service_name%7C%3D%7Cnginx&urlColumns=%5B%5D&visualizationType=%22logs%22&displayedFields=%5B%5D&var-fieldBy=$__all`
    );
    await page.getByRole('link', { name: 'Select cluster' }).click();
    await expect.poll(() => page.getByTestId('data-testid button-filter-exclude').count()).toBeGreaterThan(0);
    const excludeButtons = await page.getByTestId('data-testid button-filter-exclude').all();

    for (const locator of excludeButtons) {
      await locator.click();
    }
    await expect(page.getByText('No labels match these filters.')).toHaveCount(1);
    await page.getByText('Clear filters').click();
    await expect.poll(() => explorePage.getAllPanelsLocator().count()).toBeGreaterThan(0);
  });

  test('should see empty fields UI', async ({ page }) => {
    await page.goto(
      `/a/grafana-lokiexplore-app/explore/service/nginx/fields?var-ds=gdev-loki&from=${encodeURIComponent(STATIC_FROM)}&to=${encodeURIComponent(STATIC_TO)}&patterns=%5B%5D&var-fields=&var-levels=&var-patterns=&var-lineFilter=&var-filters=service_name%7C%3D%7Cnginx&urlColumns=%5B%5D&visualizationType=%22logs%22&displayedFields=%5B%5D&var-fieldBy=$__all`
    );
    await expect(page.getByText('We did not find any fields for the given time range.')).toHaveCount(1);
    await expect(explorePage.getAllPanelsLocator()).toHaveCount(0);
    await explorePage.addCustomValueToCombobox('test', FilterOp.Equal, ComboBoxIndex.fields, 'test', 'test');
    await expect(page.getByText('No fields match these filters.')).toHaveCount(1);
    await page.getByText('Clear filters').click();
    await expect(page.getByText('We did not find any fields for the given time range.')).toHaveCount(1);
  });

  test('should see clear fields UI', async ({ page }) => {
    await page.goto(
      `/a/grafana-lokiexplore-app/explore/service/nginx-json/fields?var-ds=gdev-loki&from=${encodeURIComponent(STATIC_FROM)}&to=${encodeURIComponent(STATIC_TO)}&patterns=%5B%5D&var-fields=bytes|=|""&var-levels=&var-patterns=&var-lineFilter=&var-filters=service_name%7C%3D%7Cnginx-json&urlColumns=%5B%5D&visualizationType=%22logs%22&displayedFields=%5B%5D&var-fieldBy=$__all`
    );
    await expect(page.getByText('No fields match these filters.')).toHaveCount(1);
    await expect(page.getByLabel(E2EComboboxStrings.editByKey('bytes'))).toHaveCount(1);
    await expect(explorePage.getAllPanelsLocator()).toHaveCount(0);
    await page.getByText('Clear filters').click();
    await expect(page.getByLabel(E2EComboboxStrings.editByKey('bytes'))).toHaveCount(0);
    await expect(explorePage.getAllPanelsLocator().first()).toHaveCount(1);
    await expect(explorePage.getAllPanelsLocator().first()).toBeVisible();
    await expect(explorePage.getAllPanelsLocator().first()).toBeInViewport();
  });

  // Disabled: this test was designed against the live `generator` service,
  // where excluding `version` brought the `content` series count below
  // Loki's `max_query_series` (500) and cleared the panel error. The static
  // snapshot (`tests/static-loki/provisioning/loki/data.zip`) bakes in `noisyTempo` output
  // with per-line random `[compactor-XXXX]` content values, so `content`
  // permanently has thousands of unique series regardless of the version
  // filter. Re-enable this once the snapshot is regenerated with bounded
  // `content`/`oldContent` cardinality (or the test is rewritten to mock
  // the breakdown query response).
  test.skip('should not see maximum of series limit reached after changing filters', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      legendFormats: [`{{${levelName}}}`],
      refIds: ['logsPanelQuery', 'content', 'version'],
    });

    const panelErrorLocator = page.getByTestId('data-testid Panel status error');
    const contentPanelLocator = page.getByTestId('data-testid Panel header content');
    const versionPanelLocator = page.getByTestId('data-testid Panel header version');
    const versionVariableLocator = page.getByLabel(E2EComboboxStrings.editByKey('version'));
    const versionFilterButton = page.getByRole('menuitemradio', { name: /Exclude/ });

    // Go to the fields tab and wait for panels to load
    await explorePage.goToFieldsTab();
    await expect.poll(() => contentPanelLocator.count()).toEqual(1);
    await expect.poll(() => versionPanelLocator.count()).toEqual(1);

    // Open the dropdown and change from include to exclude
    await versionPanelLocator.getByTestId(testIds.breakdowns.common.filterSelect).click();
    await versionFilterButton.click();

    // Exclude version
    await expect.poll(() => versionVariableLocator.count()).toEqual(1);
    await expect.poll(() => versionVariableLocator.textContent()).toContain('=');
    await expect.poll(() => versionVariableLocator.textContent()).not.toContain('!=');

    // Open the menu
    await versionVariableLocator.click();
    await page.getByLabel('Edit filter operator').click();

    // assert the options are showing
    await expect(explorePage.getOperatorLocator(FilterOp.Equal)).toHaveCount(1);
    await expect(explorePage.getOperatorLocator(FilterOp.NotEqual)).toHaveCount(1);
    await expect(explorePage.getOperatorLocator(FilterOp.RegexEqual)).toHaveCount(1);
    await expect(explorePage.getOperatorLocator(FilterOp.RegexNotEqual)).toHaveCount(1);

    // Click the other option and exclude version
    await explorePage.getOperatorLocator(FilterOp.NotEqual).click();

    // Need to use the keyboard because by default the combobox matches everything until the user starts typing, even if a value is already present
    // @todo is this a bug in the combobox?
    await page.keyboard.press('Tab');

    // Check the right options are visible
    await expect(versionVariableLocator).toContainText('!=');

    // Assert no panel errors after changing filters
    await expect.poll(() => panelErrorLocator.count()).toEqual(0);

    // Now assert that content is hidden (will hit 1000 series limit and throw error)
    // @todo update in https://github.com/grafana/logs-drilldown/issues/1465 that we're showing a warning
    await expect(contentPanelLocator).toHaveCount(1);
    // But version should exist
    await expect(versionPanelLocator).toHaveCount(1);
  });

  test('should update label set if detected_labels is loaded in another tab', async ({ page }) => {
    explorePage.blockAllQueriesExcept({});
    await explorePage.goToLabelsTab();

    const tabCountLocator = page.getByTestId(testIds.exploreServiceDetails.tabLabels).locator('> span');
    await expect(tabCountLocator).not.toBeEmpty();
    const panels = explorePage.getAllPanelsLocator();
    // Count panels, compare to tab count
    await expect(panels).toHaveCount(parseInt((await tabCountLocator.textContent()) as string, 10));

    await explorePage.goToLogsTab();
    await page.getByLabel('Edit filter with key').click();
    await page.getByText('mimir-ingester').click();
    await explorePage.goToLabelsTab();

    // Count panels, compare to tab count
    await expect(panels).toHaveCount(parseInt((await tabCountLocator.textContent()) as string, 10));
  });

  // @todo get it working with new logs panel options which were GA-ed in 12.1.3
  test.skip('logs panel options: line wrap', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: ['logsPanelQuery'],
    });

    // Check default values
    expect(await explorePage.getLogsDirectionNewestFirstLocator().isChecked()).toBe(true);
    expect(await explorePage.getLogsDirectionOldestFirstLocator().isChecked()).toBe(false);

    expect(await explorePage.getNowrapLocator().isChecked()).toBe(true);
    expect(await explorePage.getWrapLocator().isChecked()).toBe(false);

    expect(await explorePage.getTableToggleLocator().isChecked()).toBe(false);
    expect(await explorePage.getLogsToggleLocator().isChecked()).toBe(true);

    const firstRow = explorePage.getLogsPanelRow();
    const viewportSize = page.viewportSize();

    // Assert that the row has more width then the viewport (can scroll horizontally)
    expect((await firstRow.boundingBox())?.width).toBeGreaterThanOrEqual(viewportSize?.width ?? -1);

    // Change line wrap
    await explorePage.getWrapLocator().click();

    expect(await explorePage.getNowrapLocator().isChecked()).toBe(false);
    expect(await explorePage.getWrapLocator().isChecked()).toBe(true);

    // Assert that the width is less than or equal to the window width (cannot scroll horizontally)
    expect((await firstRow.boundingBox())?.width).toBeLessThanOrEqual(viewportSize?.width ?? Infinity);

    // Reload the page and verify the setting in local storage is applied to the panel
    await page.reload({ waitUntil: 'domcontentloaded' });
    expect(await explorePage.getNowrapLocator().isChecked()).toBe(false);
    expect(await explorePage.getWrapLocator().isChecked()).toBe(true);
    expect((await firstRow.boundingBox())?.width).toBeLessThanOrEqual(viewportSize?.width ?? Infinity);
  });

  // @todo get it working with new logs panel options which were GA-ed in 12.1.3
  test.skip('logs panel options: sortOrder', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: ['logsPanelQuery'],
    });
    const firstRow = explorePage.getLogsPanelRow();
    const secondRow = explorePage.getLogsPanelRow(1);
    // third td/cell is time
    const firstRowTimeCell = firstRow.getByRole('cell').nth(2);
    const secondRowTimeCell = secondRow.getByRole('cell').nth(2);

    // Check default values
    expect(await explorePage.getLogsDirectionNewestFirstLocator().isChecked()).toBe(true);
    expect(await explorePage.getLogsDirectionOldestFirstLocator().isChecked()).toBe(false);

    expect(await explorePage.getNowrapLocator().isChecked()).toBe(true);
    expect(await explorePage.getWrapLocator().isChecked()).toBe(false);

    expect(await explorePage.getTableToggleLocator().isChecked()).toBe(false);
    expect(await explorePage.getLogsToggleLocator().isChecked()).toBe(true);

    // assert timesstamps are DESC (newest first)
    expect(new Date(await firstRowTimeCell.textContent()).valueOf()).toBeGreaterThanOrEqual(
      new Date(await secondRowTimeCell.textContent()).valueOf()
    );

    // Changing the sort order triggers a new query with the opposite query direction
    let queryWithForwardDirectionExecuted = false;
    await explorePage.waitForRequest(
      // Change sort order
      () => explorePage.getLogsDirectionOldestFirstLocator().click(),
      () => {
        queryWithForwardDirectionExecuted = true;
      },
      (q) => q.direction === LokiQueryDirection.Forward
    );

    expect(queryWithForwardDirectionExecuted).toEqual(true);

    expect(await explorePage.getLogsDirectionNewestFirstLocator().isChecked()).toBe(false);
    expect(await explorePage.getLogsDirectionOldestFirstLocator().isChecked()).toBe(true);

    // Scroll the whole page to the bottom so the whole logs panel is visible
    await explorePage.scrollToBottom();

    // assert timestamps are ASC (oldest first)
    expect(new Date(await firstRowTimeCell.textContent()).valueOf()).toBeLessThanOrEqual(
      new Date(await secondRowTimeCell.textContent()).valueOf()
    );

    // Reload the page
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Verify options are correct
    expect(await explorePage.getLogsDirectionNewestFirstLocator().isChecked()).toBe(false);
    expect(await explorePage.getLogsDirectionOldestFirstLocator().isChecked()).toBe(true);

    // assert timestamps are still ASC (oldest first)
    expect(new Date(await firstRowTimeCell.textContent()).valueOf()).toBeLessThanOrEqual(
      new Date(await secondRowTimeCell.textContent()).valueOf()
    );
  });

  // @todo get it working with new logs panel options which were GA-ed in 12.1.3
  test.skip('logs panel options: url sync', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: ['logsPanelQuery', 'A'],
    });

    // Check default values
    expect(await explorePage.getLogsDirectionNewestFirstLocator().isChecked()).toBe(true);
    expect(await explorePage.getLogsDirectionOldestFirstLocator().isChecked()).toBe(false);

    expect(await explorePage.getNowrapLocator().isChecked()).toBe(true);
    expect(await explorePage.getWrapLocator().isChecked()).toBe(false);

    const viewportSize = page.viewportSize();

    // Check annotation location
    const boundingBoxDesc = await page.getByTestId('data-testid annotation-marker').boundingBox();

    // Annotation should be on the right side of the viewport
    expect(boundingBoxDesc?.x).toBeGreaterThan((viewportSize?.width ?? -1) / 2);

    // Check non-default values
    await explorePage.gotoLogsPanel('Ascending', 'true');

    expect(await explorePage.getLogsDirectionNewestFirstLocator().isChecked()).toBe(false);
    expect(await explorePage.getLogsDirectionOldestFirstLocator().isChecked()).toBe(true);

    expect(await explorePage.getNowrapLocator().isChecked()).toBe(false);
    expect(await explorePage.getWrapLocator().isChecked()).toBe(true);

    // Check annotation location
    const boundingBoxAsc = await page.getByTestId('data-testid annotation-marker').boundingBox();

    // Annotation should be on the left side of the viewport
    expect(boundingBoxAsc?.x).toBeLessThan((viewportSize?.width ?? Infinity) / 2);
  });
});
