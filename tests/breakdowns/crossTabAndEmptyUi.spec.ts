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

  // Static snapshot keeps `content` high-cardinality; we assert the filter flow
  // completes and panels stay usable (no requirement that max-series clears).
  test('version exclude filter flow on fields tab with static snapshot', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      legendFormats: [`{{${levelName}}}`],
      refIds: ['logsPanelQuery', 'content', 'version'],
    });

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

    await explorePage.assertPanelsNotLoading();
    await expect(contentPanelLocator).toHaveCount(1);
    await expect(versionPanelLocator).toHaveCount(1);
    await expect.poll(async () => page.getByTestId('data-testid Panel status error').count()).toBeGreaterThan(0);
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

  test('logs panel options: line wrap', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: ['logsPanelQuery'],
    });

    await expect(explorePage.getLogsDirectionNewestFirstLocator()).toBeVisible();
    await expect(explorePage.getLogsDirectionOldestFirstLocator()).not.toBeVisible();

    await explorePage.expectLogsWrapToolbarDefault();

    expect(await explorePage.getTableToggleLocator().isChecked()).toBe(false);
    expect(await explorePage.getLogsToggleLocator().isChecked()).toBe(true);

    const firstRow = explorePage.getLogsPanelRow();
    const viewportSize = page.viewportSize();

    await explorePage.setLogsLineWrapMenu(true);
    await expect(page).toHaveURL(/wrapLogMessage=(%22)?true(%22)?/);

    // Reload the page and verify the setting in local storage is applied to the panel
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/wrapLogMessage=(%22)?true(%22)?/);
    const firstRowAfterReload = explorePage.getLogsPanelRow();
  });

  test('logs panel options: sortOrder', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: ['logsPanelQuery'],
    });

    const firstRowTimeCell = explorePage.getLogsPanelRowTimestampLocator(0);
    const secondRowTimeCell = explorePage.getLogsPanelRowTimestampLocator(1);

    await expect(explorePage.getLogsDirectionNewestFirstLocator()).toBeVisible();
    await expect(explorePage.getLogsDirectionOldestFirstLocator()).not.toBeVisible();

    await explorePage.expectLogsWrapToolbarDefault();

    expect(await explorePage.getTableToggleLocator().isChecked()).toBe(false);
    expect(await explorePage.getLogsToggleLocator().isChecked()).toBe(true);

    // assert timesstamps are DESC (newest first)
    const t0 = (await firstRowTimeCell.textContent()) ?? '';
    const t1 = (await secondRowTimeCell.textContent()) ?? '';
    expect(new Date(t0).valueOf()).toBeGreaterThanOrEqual(new Date(t1).valueOf());

    // Changing the sort order triggers a new query with the opposite query direction
    let queryWithForwardDirectionExecuted = false;
    await explorePage.waitForRequest(
      // Change sort order (single toggle: newest-first button → oldest-first)
      () => explorePage.getLogsDirectionNewestFirstLocator().click(),
      () => {
        queryWithForwardDirectionExecuted = true;
      },
      (q) => q.direction === LokiQueryDirection.Forward
    );

    expect(queryWithForwardDirectionExecuted).toEqual(true);

    await expect(explorePage.getLogsDirectionOldestFirstLocator()).toBeVisible();
    await expect(explorePage.getLogsDirectionNewestFirstLocator()).not.toBeVisible();

    // Scroll the whole page to the bottom so the whole logs panel is visible
    await explorePage.scrollToBottom();

    // assert timestamps are ASC (oldest first; rows can lag briefly behind the query)
    await expect
      .poll(async () => {
        const a = await explorePage.getLogsPanelRowTimestampLocator(0).textContent();
        const b = await explorePage.getLogsPanelRowTimestampLocator(1).textContent();
        if (a == null || b == null) {
          return false;
        }
        return new Date(a).valueOf() <= new Date(b).valueOf();
      })
      .toBe(true);

    // Reload the page
    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(explorePage.getLogsDirectionOldestFirstLocator()).toBeVisible();
    await expect(explorePage.getLogsDirectionNewestFirstLocator()).not.toBeVisible();

    // assert timestamps are still ASC (oldest first)
    await expect
      .poll(async () => {
        const a = await explorePage.getLogsPanelRowTimestampLocator(0).textContent();
        const b = await explorePage.getLogsPanelRowTimestampLocator(1).textContent();
        if (a == null || b == null) {
          return false;
        }
        return new Date(a).valueOf() <= new Date(b).valueOf();
      })
      .toBe(true);
  });

  test('logs panel options: url sync', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: ['logsPanelQuery', 'A'],
    });

    await expect(explorePage.getLogsDirectionNewestFirstLocator()).toBeVisible();
    await expect(explorePage.getLogsDirectionOldestFirstLocator()).not.toBeVisible();

    await explorePage.expectLogsWrapToolbarDefault();

    const viewportSize = page.viewportSize();

    // Check annotation location
    const boundingBoxDesc = await page.getByTestId('data-testid annotation-marker').boundingBox();

    // Annotation should be on the right side of the viewport
    expect(boundingBoxDesc?.x).toBeGreaterThan((viewportSize?.width ?? -1) / 2);

    // Check non-default values
    await explorePage.gotoLogsPanel('Ascending', 'true');

    await expect(explorePage.getLogsDirectionOldestFirstLocator()).toBeVisible();
    await expect(explorePage.getLogsDirectionNewestFirstLocator()).not.toBeVisible();

    await expect(page).toHaveURL(/wrapLogMessage=(%22)?true(%22)?/);

    // Check annotation location
    const boundingBoxAsc = await page.getByTestId('data-testid annotation-marker').boundingBox();

    // Annotation should be on the left side of the viewport
    expect(boundingBoxAsc?.x).toBeLessThan((viewportSize?.width ?? Infinity) / 2);
  });
});
