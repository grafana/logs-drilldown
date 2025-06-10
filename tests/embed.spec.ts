import { Page } from '@playwright/test';

import { expect, test } from '@grafana/plugin-e2e';

import { PageSlugs, ValueSlugs } from '../src/services/enums';
import { FilterOp } from '../src/services/filterTypes';
import { testIds } from '../src/services/testIds';
import { ComboBoxIndex, ExplorePage } from './fixtures/explore';

const fieldName = 'caller';
const labelName = 'cluster';

async function expectButtonsSelected(page: Page) {
  await expect(page.getByTestId(testIds.exploreServiceDetails.buttonFilterInclude).nth(0)).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(page.getByTestId(testIds.exploreServiceDetails.buttonFilterInclude).nth(1)).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(page.getByTestId(testIds.exploreServiceDetails.buttonFilterInclude).nth(2)).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(page.getByTestId(testIds.exploreServiceDetails.buttonFilterInclude).nth(3)).toHaveAttribute(
    'aria-selected',
    'true'
  );
}

async function assertPatternTabActive(page: Page) {
  await expect(page.getByTestId(testIds.exploreServiceDetails.tabPatterns)).toHaveCount(1);
  await expect(page.getByTestId(testIds.exploreServiceDetails.tabPatterns)).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL((url) => url.search.includes(`pageSlug=${PageSlugs.patterns}`));
}

async function assertFieldsTabActive(page: Page, urlCheck = true) {
  await expect(page.getByTestId(testIds.exploreServiceDetails.tabFields)).toHaveCount(1);
  await expect(page.getByTestId(testIds.exploreServiceDetails.tabFields)).toHaveAttribute('aria-selected', 'true');
  if (urlCheck) {
    await expect(page).toHaveURL((url) => url.search.includes(`pageSlug=${PageSlugs.fields}`));
  }
}

async function assertLabelsTabActive(page: Page, urlCheck = true) {
  await expect(page.getByTestId(testIds.exploreServiceDetails.tabLabels)).toHaveCount(1);
  await expect(page.getByTestId(testIds.exploreServiceDetails.tabLabels)).toHaveAttribute('aria-selected', 'true');
  if (urlCheck) {
    await expect(page).toHaveURL((url) => url.search.includes(`pageSlug=${PageSlugs.labels}`));
  }
}

async function assertLogsTabActive(page: Page) {
  await expect(page.getByTestId(testIds.exploreServiceDetails.tabLogs)).toHaveCount(1);
  await expect(page.getByTestId(testIds.exploreServiceDetails.tabLogs)).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL((url) => url.search.includes(`pageSlug=${PageSlugs.logs}`));
}

test.describe.only('embed', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page }, testInfo) => {
    explorePage = new ExplorePage(page, testInfo);

    await explorePage.setExtraTallViewportSize();
    await explorePage.clearLocalStorage();
    // Make it go. Make it go fast.
    explorePage.blockAllQueriesExcept({
      refIds: ['null'],
    });
    await explorePage.gotoEmbedUrl();
    explorePage.captureConsoleLogs();

    await explorePage.assertNotLoading();
    await explorePage.assertTabsNotLoading();
  });

  test.afterEach(async ({ page }) => {
    await explorePage.unroute();
    explorePage.echoConsoleLogsOnRetry();
  });

  test('can navigate between tabs', async ({ page }) => {
    // Logs tab
    await assertLogsTabActive(page);

    // Labels tab
    await explorePage.goToLabelsTab();
    await assertLabelsTabActive(page);

    // Fields tab
    await explorePage.goToFieldsTab();
    await assertFieldsTabActive(page);

    // Patterns tab
    await explorePage.goToPatternsTab();
    await assertPatternTabActive(page);

    // Go back to fields
    await page.goBack();
    await assertFieldsTabActive(page);

    // go back to labels
    await page.goBack();
    await assertLabelsTabActive(page);

    // go back to logs
    await page.goBack();
    await assertLogsTabActive(page);
  });

  test('can navigate to value drilldowns', async ({ page }) => {
    await explorePage.goToLabelsTab();
    await assertLabelsTabActive(page);
    // Go to value drilldown
    await page.getByLabel(`Select ${labelName}`).click();

    // Assert the tab is still active
    await assertLabelsTabActive(page, false);
    await expect(page).toHaveURL(
      (url) => url.search.includes(`pageSlug=${ValueSlugs.label}`) && url.search.includes(`drillDownLabel=${labelName}`)
    );
  });

  test('can navigate to field drilldowns', async ({ page }) => {
    await explorePage.goToFieldsTab();
    await assertFieldsTabActive(page);

    // Go to value drilldown
    await page.getByLabel(`Select ${fieldName}`).click();

    // Assert the tab is still active
    await assertFieldsTabActive(page, false);
    await expect(page).toHaveURL(
      (url) => url.search.includes(`pageSlug=${ValueSlugs.field}`) && url.search.includes(`drillDownLabel=${fieldName}`)
    );
  });

  test('can use browser history to undo adding field filters via the UI', async ({ page }) => {
    await explorePage.goToFieldsTab();

    // Load the field values
    explorePage.blockAllQueriesExcept({
      refIds: [fieldName],
    });

    // Go to value drilldown
    await page.getByLabel(`Select ${fieldName}`).click();
    await explorePage.assertNotLoading();

    // Click filters
    await expect(page.getByTestId(testIds.exploreServiceDetails.buttonFilterInclude)).toHaveCount(8);
    await page.getByTestId(testIds.exploreServiceDetails.buttonFilterInclude).nth(0).click();
    await page.getByTestId(testIds.exploreServiceDetails.buttonFilterInclude).nth(1).click();
    await page.getByTestId(testIds.exploreServiceDetails.buttonFilterInclude).nth(2).click();
    await page.getByTestId(testIds.exploreServiceDetails.buttonFilterInclude).nth(3).click();

    // Assert they are selected
    await expectButtonsSelected(page);

    // Go back, assert buttons are unselected
    await page.goBack();
    await expect(page.getByTestId(testIds.exploreServiceDetails.buttonFilterInclude).nth(3)).toHaveAttribute(
      'aria-selected',
      'false'
    );
    await expect(page.getByTestId(testIds.exploreServiceDetails.buttonFilterInclude).nth(2)).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.getByTestId(testIds.exploreServiceDetails.buttonFilterInclude).nth(1)).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.getByTestId(testIds.exploreServiceDetails.buttonFilterInclude).nth(0)).toHaveAttribute(
      'aria-selected',
      'true'
    );

    await page.goBack();
    await expect(page.getByTestId(testIds.exploreServiceDetails.buttonFilterInclude).nth(2)).toHaveAttribute(
      'aria-selected',
      'false'
    );
    await expect(page.getByTestId(testIds.exploreServiceDetails.buttonFilterInclude).nth(1)).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.getByTestId(testIds.exploreServiceDetails.buttonFilterInclude).nth(0)).toHaveAttribute(
      'aria-selected',
      'true'
    );

    await page.goBack();
    await expect(page.getByTestId(testIds.exploreServiceDetails.buttonFilterInclude).nth(1)).toHaveAttribute(
      'aria-selected',
      'false'
    );
    await expect(page.getByTestId(testIds.exploreServiceDetails.buttonFilterInclude).nth(0)).toHaveAttribute(
      'aria-selected',
      'true'
    );

    await page.goBack();
    await expect(page.getByTestId(testIds.exploreServiceDetails.buttonFilterInclude).nth(0)).toHaveAttribute(
      'aria-selected',
      'false'
    );

    await page.goForward();
    await page.goForward();
    await page.goForward();
    await page.goForward();

    // Assert the buttons are selected again
    await expectButtonsSelected(page);
  });

  test('can nav to unembedded logs drilldown and return to service selection scene', async ({ page }) => {
    // add some field filter
    await explorePage.addCustomValueToCombobox(fieldName, FilterOp.RegexEqual, ComboBoxIndex.fields, `.+st.+`, 'ca');

    // go to full logs drilldown via the link button
    await page.getByRole('link', { name: 'Logs Drilldown' }).click();

    // should see data source picker now
    await expect(page.getByTestId(testIds.variables.datasource.label)).toHaveCount(1);

    // assert filter is still active
    await expect(page.getByRole('button', { name: 'Edit filter with key caller' })).toHaveCount(1);

    // Remove the primary label filter
    await page.getByRole('button', { name: 'Remove filter with key service_name' }).click();

    // Assert something from the service selection is visible
    await expect(page.getByTestId(testIds.index.addNewLabelTab)).toHaveCount(1);
  });

  test('can add label and refresh page without losing readonly', async ({ page }) => {
    async function assertFiltersAreReadOnly() {
      await expect(page.getByLabel('Edit filter with key service_name')).toHaveCount(1);
      await expect(page.getByLabel('Edit filter with key cluster')).toHaveCount(1);
      await expect(page.getByLabel('Remove filter with key service_name')).toHaveCount(0);
      await expect(page.getByLabel('Remove filter with key cluster')).toHaveCount(1);
    }

    await explorePage.addCustomValueToCombobox(labelName, FilterOp.RegexEqual, ComboBoxIndex.labels, `us-.+`);
    await assertFiltersAreReadOnly();
    await page.reload();
    await assertFiltersAreReadOnly();
  });
});
