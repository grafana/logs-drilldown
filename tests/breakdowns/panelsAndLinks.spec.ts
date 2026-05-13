import { expect, test } from '@grafana/plugin-e2e';

import { FilterOp } from '../../src/services/filterTypes';
import { testIds } from '../../src/services/testIds';
import { CapturedResponse, CapturedResponses, ComboBoxIndex, ExplorePage } from '../fixtures/explore';

import { fieldName, levelName, setupServiceBreakdownTest, teardownServiceBreakdownTest } from './shared';

test.describe('Panels and links', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page, grafanaVersion }, testInfo) => {
    explorePage = await setupServiceBreakdownTest(page, grafanaVersion, testInfo);
  });

  test.afterEach(async () => {
    await teardownServiceBreakdownTest(explorePage);
  });

  test('url sharing', async ({ page }) => {
    explorePage.blockAllQueriesExcept({ refIds: ['NA'] });
    await page.getByLabel('Copy shortened URL').click();
    await expect(page.getByText('Shortened link copied to')).toBeVisible();
  });

  test('panel menu: label name panel should open links in explore', async ({ context, page }) => {
    await explorePage.goToLabelsTab();
    await page.getByTestId('data-testid Panel menu detected_level').click();

    // Open link
    await expect(page.getByTestId('data-testid Panel menu item Explore')).toHaveAttribute('href');
    await page.getByTestId('data-testid Panel menu item Explore').click();

    const newPageCodeEditor = explorePage.getExploreCodeQueryLocator();
    await expect(newPageCodeEditor).toBeInViewport();
    await expect(newPageCodeEditor).toContainText(
      'sum(count_over_time({service_name="tempo-distributor"} | detected_level != "" [$__auto])) by (detected_level)'
    );
  });

  test('panel menu: label value panel should open links in explore', async ({ context, page }) => {
    await explorePage.goToLabelsTab();
    await page.getByLabel(`Select ${levelName}`).click();
    await page.getByTestId('data-testid Panel menu error').click();

    // Open link
    await expect(page.getByTestId('data-testid Panel menu item Explore')).toHaveAttribute('href');
    await page.getByTestId('data-testid Panel menu item Explore').click();

    const newPageCodeEditor = explorePage.getExploreCodeQueryLocator();
    await expect(newPageCodeEditor).toBeInViewport();
    await expect(newPageCodeEditor).toContainText(
      'sum(count_over_time({service_name="tempo-distributor"} | detected_level != "" [$__auto])) by (detected_level)'
    );
  });

  test('panel menu: field name panel should open links in explore', async ({ context, page }) => {
    await explorePage.goToFieldsTab();
    await page.getByTestId(`data-testid Panel menu ${fieldName}`).click();

    // Open link
    await expect(page.getByTestId('data-testid Panel menu item Explore')).toHaveAttribute('href');
    await page.getByTestId('data-testid Panel menu item Explore').click();

    const newPageCodeEditor = explorePage.getExploreCodeQueryLocator();
    await expect(newPageCodeEditor).toBeInViewport();
    await expect(newPageCodeEditor).toContainText(
      `sum by (${fieldName}) (count_over_time({service_name="tempo-distributor"} | logfmt | ${fieldName}!="" [$__auto]))`
    );
  });

  test('panel menu: field value panel should open links in explore', async ({ context, page }) => {
    await explorePage.goToFieldsTab();
    await page.getByLabel('Select caller').click();

    // Assert we've navigated to the sub page
    await expect(page.getByTestId('data-testid Panel menu poller.go:133')).toHaveCount(1);
    await page.getByTestId('data-testid Panel menu poller.go:133').click();

    // Open link
    await expect(page.getByTestId('data-testid Panel menu item Explore')).toHaveAttribute('href');
    await page.getByTestId('data-testid Panel menu item Explore').click();

    const newPageCodeEditor = explorePage.getExploreCodeQueryLocator();
    await expect(newPageCodeEditor).toBeInViewport();
    await expect(newPageCodeEditor).toContainText(
      `sum by (${fieldName}) (count_over_time({service_name="tempo-distributor"} | logfmt | ${fieldName}!="" [$__auto]))`
    );
  });

  test('label value summary panel: text search', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      legendFormats: [`{{${levelName}}}`],
      refIds: [],
    });
    await explorePage.goToLabelsTab();
    await page.getByLabel(`Select ${levelName}`).click();

    const summaryPanel = page.getByTestId('data-testid Panel header detected_level');
    const summaryPanelBody = summaryPanel.getByTestId('data-testid panel content');
    const labelValueTextSearch = page.getByPlaceholder('Search for value');

    const debugPanel = page.getByTestId('data-testid Panel header debug');
    const warnPanel = page.getByTestId('data-testid Panel header warn');
    const infoPanel = page.getByTestId('data-testid Panel header info');
    const errorPanel = page.getByTestId('data-testid Panel header error');

    const debugLegend = page.getByTestId('data-testid VizLegend series debug').getByRole('button', { name: 'debug' });
    const warnLegend = page.getByTestId('data-testid VizLegend series warn').getByRole('button', { name: 'warn' });
    const infoLegend = page.getByTestId('data-testid VizLegend series info').getByRole('button', { name: 'info' });
    const errorLegend = page.getByTestId('data-testid VizLegend series error').getByRole('button', { name: 'error' });

    async function assertAllLevelsAreVisible() {
      // Assert the value panels are visible
      await expect(errorPanel).toBeVisible();
      await expect(warnPanel).toBeVisible();
      await expect(infoPanel).toBeVisible();
      await expect(debugPanel).toBeVisible();

      // Assert the legend options are visible
      await expect(errorLegend).toBeVisible();
      await expect(warnLegend).toBeVisible();
      await expect(infoLegend).toBeVisible();
      await expect(debugLegend).toBeVisible();
    }

    // assert by default, the summary panel is expanded
    await expect(summaryPanel).toBeVisible();
    await expect(summaryPanelBody).toBeVisible();

    await assertAllLevelsAreVisible();

    // Add text search
    await labelValueTextSearch.pressSequentially('wa');

    // Assert the value panels are not visible (except warn)
    await expect(errorPanel).not.toBeVisible();
    await expect(warnPanel).toBeVisible();
    await expect(infoPanel).not.toBeVisible();
    await expect(debugPanel).not.toBeVisible();

    // Assert the legend options are visible (except warn)
    await expect(errorLegend).not.toBeVisible();
    await expect(warnLegend).toBeVisible();
    await expect(infoLegend).not.toBeVisible();
    await expect(debugLegend).not.toBeVisible();
    // Clear the text search
    await page.getByLabel('Clear search').click();

    // Assert the value panels are visible
    await assertAllLevelsAreVisible();
  });

  test('field value summary panel: collapsable', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: [fieldName],
    });

    await explorePage.goToFieldsTab();
    await explorePage.click(page.getByLabel(`Select ${fieldName}`));

    const summaryPanel = page.getByTestId(`data-testid Panel header ${fieldName}`);
    const summaryPanelBody = summaryPanel.getByTestId('data-testid panel content');
    const summaryPanelCollapseButton = page.getByRole('button', { exact: true, name: fieldName });

    const vizPanelMenu = page.getByTestId(`data-testid Panel menu ${fieldName}`);
    const vizPanelMenuExpandOption = page.getByTestId('data-testid Panel menu item Expand');

    // assert by default, the summary panel is expanded
    await expect(summaryPanel).toBeVisible();
    await expect(summaryPanelBody).toBeVisible();

    // Collapse
    await summaryPanelCollapseButton.click();

    // assert panel is collapsed
    await expect(summaryPanel).toBeVisible();
    await expect(summaryPanelBody).not.toBeVisible();

    // Reload the page
    await page.reload({ waitUntil: 'domcontentloaded' });
    await explorePage.assertNotLoading();

    // Assert the collapse state was saved to local storage and set as default
    await expect(summaryPanel).toBeVisible();
    await expect(summaryPanelBody).not.toBeVisible();

    // Open viz panel menu and toggle collapse state that way
    await vizPanelMenu.click();

    // Assert the "expand" option is visible in the menu
    await expect(vizPanelMenuExpandOption).toBeVisible();

    // Expand the panel
    await vizPanelMenuExpandOption.click();

    // Assert the panel body is visible again
    await expect(summaryPanel).toBeVisible();
    await expect(summaryPanelBody).toBeVisible();
  });

  test('field value breakdown: changing parser updates query', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: [fieldName],
    });

    await explorePage.goToFieldsTab();

    // Use the dropdown since the tenant field might not be visible
    await page.getByLabel(`Select ${fieldName}`).click();

    await expect(explorePage.getAllPanelsLocator()).toHaveCount(9);

    // add a field with logfmt parser
    await explorePage.addNthValueToCombobox('content', FilterOp.Equal, ComboBoxIndex.fields, 2, 'con');

    await explorePage.assertPanelsNotLoading();

    await expect(explorePage.getAllPanelsLocator()).toHaveCount(2);
  });

  test('label value breakdown: changing parser updates query', async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: ['LABEL_BREAKDOWN_VALUES'],
    });

    await explorePage.goToLabelsTab();

    // Use the dropdown since the tenant field might not be visible (label + value no longer one "LabelAll" text node)
    await page.getByLabel(`Select ${levelName}`).click();

    await expect(explorePage.getAllPanelsLocator()).toHaveCount(5);

    // add a field with logfmt parser
    await explorePage.addNthValueToCombobox('content', FilterOp.Equal, ComboBoxIndex.fields, 2, 'con');

    await explorePage.assertPanelsNotLoading();

    await expect(explorePage.getAllPanelsLocator()).toHaveCount(2);
  });

  test('int fields should allow avg_over_time queries', async ({ page }) => {
    let responses: CapturedResponses = [];
    explorePage.blockAllQueriesExcept({
      refIds: ['values'],
      responses,
    });

    // Navigate to fields break down
    await explorePage.goToFieldsTab();
    // Open menu
    await page.getByTestId('data-testid Panel menu values').click();
    // Convert panel to avg_over_time query
    await page.getByTestId('data-testid Panel menu item Plot average').click();
    // Assert the last request is avg_over_time. Use optional chaining
    // throughout so the poll keeps retrying instead of throwing while the
    // first response is still in flight (which can happen under parallel
    // load when the click→query cycle takes a moment to settle).
    await expect
      .poll(() => {
        const lastResponse: CapturedResponse | undefined = responses[responses.length - 1];
        return lastResponse?.['values']?.results?.['values']?.frames?.[0]?.schema?.meta?.executedQueryString;
      })
      .toContain('avg_over_time({service_name="tempo-distributor"}');
    const responsesLength = responses.length;
    // Convert avg_over_time panels to histograms
    await page.getByTestId('data-testid Panel menu values').click();
    await page.getByTestId('data-testid Panel menu item Histogram').click();
    // assert the panel was converted to histogram
    await page.getByTestId('data-testid Panel menu values').click();
    await expect(page.getByTestId('data-testid Panel menu item Time series')).toBeVisible();

    for (let i = responsesLength; i < responses.length; i++) {
      const response = responses[i];
      // Check that every request that was re-issued is an avg_over_time query
      // Ideally rebuilding the panel shouldn't re-issue requests, but for now let's at least assert that this doesn't trigger rebuild of panels using count_over_time queries
      // @todo, is there a way to rebuild the panel without re-creating the query runners which issues fresh requests for the same query?
      expect(response['values'].results['values'].frames[0]?.schema?.meta?.executedQueryString).toContain(
        'avg_over_time({service_name="tempo-distributor"}'
      );
    }
  });
});
