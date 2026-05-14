import { expect, test } from '@grafana/plugin-e2e';

import { DEFAULT_URL_COLUMNS, DETECTED_LEVEL } from '../../src/Components/Table/constants';
import { testIds } from '../../src/services/testIds';
import { ExplorePage, levelTextMatch } from '../fixtures/explore';

import { fieldName, levelName, setupServiceBreakdownTest, teardownServiceBreakdownTest } from './shared';

test.describe('Table', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page, grafanaVersion }, testInfo) => {
    explorePage = await setupServiceBreakdownTest(page, grafanaVersion, testInfo);
  });

  test.afterEach(async () => {
    await teardownServiceBreakdownTest(explorePage);
  });

  test('logs panel should have panel-content class suffix', async ({ page }) => {
    await explorePage.serviceBreakdownSearch.click();
    await explorePage.serviceBreakdownSearch.fill('broadcast');
    await expect(explorePage.getLogsPanelLocator().locator('[class$="panel-content"]')).toBeVisible();
  });

  test(`should show "Explore" on table panel menu`, async ({ page }) => {
    await explorePage.goToLogsTab();
    // Switch to table view
    await explorePage.getTableToggleLocator().click();
    const panelMenu = page.getByTestId('data-testid Panel menu Logs');
    const panelMenuItem = page.getByTestId('data-testid Panel menu item Explore');

    await expect(panelMenu).toHaveCount(1);
    await panelMenu.click();
    await expect(panelMenuItem).toHaveCount(1);
    await panelMenuItem.click();
    await expect(page.getByRole('button', { name: 'Go queryless' })).toBeVisible();
    await expect(page.getByText(`drop __error__, __error_details__`)).toBeVisible();
  });

  test(`sync log panel displayed fields with table url columns`, async ({ page }) => {
    await explorePage.goToLogsTab();

    // Open log details
    await page.locator('.unwrapped-log-line').nth(1).click();
    await page.getByLabel('Show this field instead of').nth(1).click();

    // Switch to table view
    await explorePage.getTableToggleLocator().click();

    // Wait for both URL params to settle after switching to table view.
    await expect
      .poll(() => {
        const searchParams = new URL(page.url()).searchParams;
        const displayedFields = JSON.parse(searchParams.get('displayedFields') || '[]');
        const urlColumns = JSON.parse(searchParams.get('urlColumns') || '[]');
        const filteredUrlColumns = urlColumns.filter(
          (col: string) => !DEFAULT_URL_COLUMNS.includes(col) && col !== DETECTED_LEVEL
        );

        return JSON.stringify(displayedFields) === JSON.stringify(filteredUrlColumns);
      })
      .toBe(true);
  });

  test('table should show detected_level column when log data contains detected_level', async ({ page }) => {
    await explorePage.goToLogsTab();

    // Switch to table view
    await explorePage.getTableToggleLocator().click();
    const table = page.getByTestId(testIds.table.wrapper);
    await expect(table).toBeVisible();

    // Check that detected_level column is present (if data contains detected_level info)
    const detectedLevelHeader = table.getByRole('columnheader').filter({ hasText: 'detected_level' });
    await expect.poll(async () => (await detectedLevelHeader.count()) > 0).toBeTruthy();
  });

  test('table should support table column sorting with URL persistence', async ({ page }) => {
    await explorePage.goToLogsTab();

    // Switch to table view
    await explorePage.getTableToggleLocator().click();
    const table = page.getByTestId(testIds.table.wrapper);
    await expect(table).toBeVisible();

    const bodyHeader = table
      .locator('button[title="Toggle SortBy"]')
      .getByRole('button', { name: 'body', exact: true });

    if ((await bodyHeader.count()) > 0) {
      await bodyHeader.click();

      // Check URL contains sort parameters for body
      await expect(page).toHaveURL(/urlColumnsSortBy=(body)/);
      await expect(page).toHaveURL(/urlColumnsSortDir=(asc)/);

      // Reload to verify persistence
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(table).toBeVisible();
      await expect(page).toHaveURL(/urlColumnsSortBy=(body)/);
      await expect(page).toHaveURL(/urlColumnsSortDir=(asc)/);
    }
  });

  test('table should show log line by default', async ({ page }) => {
    await explorePage.goToLogsTab();

    // Switch to table view
    await explorePage.getTableToggleLocator().click();
    const table = page.getByTestId(testIds.table.wrapper);
    await expect(table).toBeVisible();

    // Show log labels button should be visible since text is shown by default
    const bodyShowLogLabels = page.getByRole('button', { name: 'Show log labels' });
    await expect(bodyShowLogLabels).toHaveCount(1);
  });

  test(`should persist column ordering`, async ({ page }) => {
    const table = page.getByTestId(testIds.table.wrapper);
    await explorePage.goToLogsTab();
    // Switch to table view
    await explorePage.getTableToggleLocator().click();

    // Assert table column order
    await expect(table.getByRole('columnheader').nth(0)).toContainText('timestamp');
    await expect(table.getByRole('columnheader').nth(0)).not.toContainText('body');
    await expect(table.getByRole('columnheader').nth(1)).toContainText('body');

    // Open the menu for "Line"
    await page.getByLabel(/Show body|Line menu/).click();
    await page.getByText('Move left').click();
    await expect(table.getByRole('columnheader').nth(0)).toContainText('body');

    // Refresh the page to see if the columns were saved in the url state
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(table).toBeVisible({ timeout: 45000 });
    await expect(table.getByRole('columnheader').nth(0)).toContainText('body');
  });

  test(`should add ${levelName} filter on table click`, async ({ page }) => {
    // Switch to table view
    await explorePage.getTableToggleLocator().click();

    const table = page.getByTestId(testIds.table.wrapper);
    // switch table body to label view
    await page.getByRole('button', { name: 'Show log labels' }).click();

    // Get a detected_level debug pill, and click it
    await table.getByRole('button', { name: 'error', exact: true }).nth(1).click();
    // Get the context menu
    const pillContextMenu = page.getByRole('button', { name: 'Add to search', exact: true });
    // Assert menu is open
    await expect(pillContextMenu).toBeVisible();
    // Click the filter button
    await pillContextMenu.click();
    // New level filter should be added
    await expect(page.getByTestId(testIds.variables.levels.inputWrap)).toBeVisible();
    await expect(page.getByTestId(testIds.variables.levels.inputWrap)).toContainText(levelTextMatch);
  });

  test('table log line state should persist in the url', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: ['logsPanelQuery'],
    });
    await explorePage.getTableToggleLocator().click();
    const table = page.getByTestId(testIds.table.wrapper);

    // assert the table shows the raw log line option by default
    await expect(table).toBeVisible({ timeout: 45000 });
    await expect(table.getByTestId(testIds.table.rawLogLine).nth(0)).toBeVisible({ timeout: 45000 });
    // Show log text option should be visible by default
    await expect(page.getByRole('button', { name: 'Show log labels' })).toBeVisible();

    // Change the option
    await page.getByRole('button', { name: 'Show log labels' }).click();

    // Use `domcontentloaded` rather than the default `load` event because
    // Grafana keeps long-lived live tail/SSE connections open which prevent
    // the `load` event from firing reliably under parallel E2E load.
    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(table.getByTestId(testIds.table.rawLogLine).nth(0)).not.toBeVisible();
  });

  test('table urlColumns should be reset on log panel show original line click', async ({ page }) => {
    await explorePage.goToLogsTab();

    // open log details
    await page.locator('.unwrapped-log-line').nth(1).click();
    // click a displayed field to
    await page.getByLabel('Show this field instead of').nth(1).click();

    // Switch to table view
    await explorePage.getTableToggleLocator().click();
    const columnHeaders = await page.getByRole('columnheader');
    await expect(columnHeaders).toHaveCount(8);

    // Switch to logs view
    await explorePage.getLogsToggleLocator().click();

    // click show original log line
    await page.getByRole('button', { name: 'Show original log line' }).click();

    // Switch to table view
    await explorePage.getTableToggleLocator().click();
    const defaultColumnHeaders = await page.getByRole('columnheader');
    await expect(defaultColumnHeaders).toHaveCount(6);
  });

  test('should show inspect modal', async ({ page }) => {
    await explorePage.getTableToggleLocator().click();
    // Expect table to be rendered
    await expect(page.getByTestId(testIds.table.wrapper)).toBeVisible();

    await page.getByTestId(testIds.table.inspectLine).last().click();
    await expect(page.getByRole('dialog', { name: 'Inspect value' })).toBeVisible();
  });
});
