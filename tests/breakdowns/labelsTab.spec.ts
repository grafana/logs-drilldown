import { expect, test } from '@grafana/plugin-e2e';

import { testIds } from '../../src/services/testIds';
import { ExplorePage } from '../fixtures/explore';

import { labelName, levelName, setupServiceBreakdownTest, teardownServiceBreakdownTest } from './shared';

test.describe('Labels tab', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page, grafanaVersion }, testInfo) => {
    explorePage = await setupServiceBreakdownTest(page, grafanaVersion, testInfo);
  });

  test.afterEach(async () => {
    await teardownServiceBreakdownTest(explorePage);
  });

  test(`should select label ${levelName}, update filters, open in explore`, async ({ page }) => {
    const valueName = 'info';
    await explorePage.goToLabelsTab();
    await page.getByLabel(`Select ${levelName}`).click();
    await page.getByTestId(`data-testid Panel header ${valueName}`).getByRole('button', { name: 'Include' }).click();

    await expect(page.getByTestId(testIds.variables.levels.inputWrap)).toContainText(valueName);
    await explorePage.goToLogsTab();
    await explorePage.getLogsVolumePanelLocator().click();
    await page.getByTestId('data-testid Panel menu item Explore').click();
    await expect(page.getByText(`{service_name="tempo-distributor"} | ${levelName}="${valueName}"`)).toBeVisible();
  });
  test(`should select label ${labelName}, update filters, open in explore`, async ({ browser, page }) => {
    explorePage.blockAllQueriesExcept({
      legendFormats: [`{{${labelName}}}`],
      refIds: ['logsPanelQuery'],
    });
    const valueName = 'eu-west-1';
    await explorePage.goToLabelsTab();
    await page.getByLabel(`Select ${labelName}`).click();
    await page.getByTestId(`data-testid Panel header ${valueName}`).getByRole('button', { name: 'Include' }).click();
    await expect(page.getByLabel(`Edit filter with key ${labelName}`)).toBeVisible();

    // Navigate to logs query
    await explorePage.goToLogsTab();
    await explorePage.getLogsVolumePanelLocator().click();
    await page.getByTestId('data-testid Panel menu item Explore').click();

    await expect(
      page.getByText(
        `{service_name="tempo-distributor", ${labelName}="${valueName}"} | json | logfmt | drop __error__, __error_details__`
      )
    ).toBeVisible();

    const toolBar = page.getByLabel('Explore toolbar');
    // Assert toolbar is visible before proceeding
    await expect(toolBar).toBeVisible();
    const extensionsButton = page.getByRole('button', { name: 'Go queryless' });
    await expect(extensionsButton).toHaveCount(1);
    // Click on extensions button
    await extensionsButton.click();
    const openInExploreLocator = page.getByLabel('Open in Grafana Logs Drilldown').first();
    await expect(openInExploreLocator).toBeVisible();
    // Click on open in logs explore
    await openInExploreLocator.click();

    const openInThisTabButtonLoc = page.getByRole('button', { exact: true, name: 'Open' });
    await expect(openInThisTabButtonLoc).toBeVisible();
    // Click to open in this tab
    await openInThisTabButtonLoc.click();

    // Assert the variables are visible
    await expect(page.getByLabel(`Edit filter with key ${labelName}`)).toBeVisible();
    await expect(page.getByLabel(`Edit filter with key service_name`)).toBeVisible();

    // Assert the label variable has the correct value
    // const labelFilter = page.getByTestId('AdHocFilter-cluster');
    const labelFilter = page.getByLabel(`Edit filter with key ${labelName}`);
    await expect(labelFilter).toBeVisible();
    await expect(labelFilter).toHaveText('cluster = eu-west-1');

    // Assert service variable has correct value
    const serviceFilter = page.getByLabel(`Edit filter with key service_name`);
    await expect(serviceFilter).toBeVisible();
    await expect(serviceFilter).toHaveText('service_name = tempo-distributor');
  });

  test('should select a label, label added to url', async ({ page }) => {
    await explorePage.goToLabelsTab();
    const labelsUrlArray = page.url().split('/');
    expect(labelsUrlArray[labelsUrlArray.length - 1].startsWith('labels')).toEqual(true);

    await page.getByLabel(`Select ${levelName}`).click();
    const urlArray = page.url().split('/');
    expect(urlArray[urlArray.length - 1].startsWith(`${levelName}`)).toEqual(true);
    // Can't import the enum as it's in the same file as the PLUGIN_ID which doesn't like being imported
    expect(urlArray[urlArray.length - 2]).toEqual('label');
  });

  test(`should update label ${levelName} sort order`, async ({ page }) => {
    await explorePage.goToLabelsTab();
    await page.getByLabel(`Select ${levelName}`).click();

    // Assert loading is done and panels are showing
    const panels = page.getByTestId(/data-testid Panel header/);
    await expect(panels.first()).toBeVisible();
    const panelTitles: Array<string | null> = [];

    await expect.poll(() => panels.count()).toBeGreaterThanOrEqual(5);
    for (const panel of await panels.all()) {
      const panelTitle = await panel.getByRole('heading').textContent();
      panelTitles.push(panelTitle);
    }

    expect(panelTitles.length).toBeGreaterThan(0);

    await page.getByTestId(testIds.breakdowns.common.sortByDirection).click();
    // Desc is the default option, this should be a noop
    await page.getByRole('option', { name: 'Desc' }).click();

    await expect(panels.first()).toBeVisible();
    // assert the sort order hasn't changed
    for (let i = 0; i < panelTitles.length; i++) {
      expect(await panels.nth(i).getByRole('heading').textContent()).toEqual(panelTitles[i]);
    }

    await page.getByTestId(testIds.breakdowns.common.sortByDirection).click();
    // Now change the sort order
    await page.getByRole('option', { name: 'Asc' }).click();

    await expect(panels.first()).toBeVisible();
    // assert the sort order hasn't changed
    for (let i = 1; i < panelTitles.length; i++) {
      expect(await panels.nth(i).getByRole('heading').textContent()).toEqual(panelTitles[panelTitles.length - i]);
    }
  });
  test(`should search labels for ${levelName}`, async ({ page }) => {
    await explorePage.goToLabelsTab();
    await page.getByLabel(`Select ${levelName}`).click();
    await page.getByPlaceholder('Search for value').click();
    const panels = page.getByTestId(/data-testid Panel header/);
    await expect(panels.first()).toBeVisible();

    await explorePage.scrollToBottom();
    await expect(panels).toHaveCount(5);
    await page.keyboard.type('errr');
    await expect(panels).toHaveCount(2);
  });
});
