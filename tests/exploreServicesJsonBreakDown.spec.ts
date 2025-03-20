import { expect, test } from '@grafana/plugin-e2e';
import { E2EComboboxStrings, ExplorePage, PlaywrightRequest } from './fixtures/explore';

import { LokiQuery } from '../src/services/lokiQuery';

const fieldName = 'method';
// const levelName = 'cluster'
test.describe('explore nginx-json breakdown pages ', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page }, testInfo) => {
    explorePage = new ExplorePage(page, testInfo);
    await explorePage.setExtraTallViewportSize();
    await explorePage.clearLocalStorage();
    await explorePage.gotoServicesBreakdownOldUrl('nginx-json');
    explorePage.blockAllQueriesExcept({
      refIds: ['logsPanelQuery', fieldName],
    });
    explorePage.captureConsoleLogs();
  });

  test.afterEach(async ({ page }) => {
    await explorePage.unroute();
    explorePage.echoConsoleLogsOnRetry();
  });

  test.describe('Fields tab', () => {
    test(`should exclude ${fieldName}, request should contain json`, async ({ page }) => {
      let requests: PlaywrightRequest[] = [];
      explorePage.blockAllQueriesExcept({
        refIds: [new RegExp(`^${fieldName}$`)],
        requests,
      });
      // First request should fire here
      await explorePage.goToFieldsTab();
      await page.getByLabel(`Select ${fieldName}`).click();
      const allPanels = explorePage.getAllPanelsLocator();
      // We should have 6 panels
      await expect(allPanels).toHaveCount(7);
      // Should have 2 queries by now
      expect(requests).toHaveLength(2);
      // Exclude a panel
      await page.getByRole('button', { name: 'Exclude' }).nth(0).click();
      // Should NOT be removed from the UI
      await expect(allPanels).toHaveCount(7);

      // Adhoc content filter should be added
      await expect(page.getByLabel(E2EComboboxStrings.editByKey(fieldName))).toBeVisible();
      await expect(page.getByText('!=')).toBeVisible();

      requests.forEach((req) => {
        const post = req.post;
        const queries: LokiQuery[] = post.queries;
        queries.forEach((query) => {
          expect(query.expr.replace(/\s+/g, '')).toContain(
            `sum by (${fieldName}) (count_over_time({service_name="nginx-json"} | json method="method" | drop __error__, __error_details__ | ${fieldName}!=""`.replace(
              /\s+/g,
              ''
            )
          );
        });
      });
      expect(requests).toHaveLength(2);
    });
    test('should see too many series button', async ({ page }) => {
      explorePage.blockAllQueriesExcept({
        refIds: ['logsPanelQuery', '_25values'],
      });
      await explorePage.goToFieldsTab();
      const showAllButtonLocator = page.getByText('Show all');
      await expect(showAllButtonLocator).toHaveCount(1);
      await expect(showAllButtonLocator).toBeVisible();

      await showAllButtonLocator.click();

      await expect(showAllButtonLocator).toHaveCount(0);
    });
  });

  test.describe('JSON viz', () => {
    test('can filter top level props', async ({ page }) => {
      await explorePage.goToLogsTab();
      await explorePage.getJsonToggleLocator().click();

      // add some include filters
      const userIdentifierInclude = page.getByLabel(/Include log lines containing user-identifier=".+"/);
      await expect(userIdentifierInclude).toHaveCount(EXPANDED_NODE_COUNT); // 50 nodes are expanded by default
      await userIdentifierInclude.first().click();
      await expect(page.getByLabel('Edit filter with key user_identifier')).toHaveCount(1);

      const dateTimeInclude = page.getByLabel(/Include log lines containing datetime=".+"/);
      await dateTimeInclude.first().click();
      await expect(page.getByLabel('Edit filter with key datetime')).toHaveCount(1);

      const refererInclude = page.getByLabel(/Include log lines containing referer=".+"/);
      await refererInclude.first().click();
      await expect(page.getByLabel('Edit filter with key referer')).toHaveCount(1);

      await explorePage.assertPanelsNotLoading();
      await explorePage.assertTabsNotLoading();

      // should only have a single result now
      await expect(userIdentifierInclude).toHaveCount(1);

      // Exclude the only result
      const statusExclude = page.getByLabel(/Exclude log lines containing status=".+"/);
      await statusExclude.click();
      await expect(page.getByLabel('Edit filter with key status')).toHaveCount(1);

      // Now there should be no results
      await expect(userIdentifierInclude).toHaveCount(0);
      await expect(page.getByText('[] 0 items')).toHaveCount(1);
    });
    test('can filter nested level props', async ({ page }) => {
      await explorePage.goToLogsTab();
      await explorePage.getJsonToggleLocator().click();

      // expand nested_object
      const expandNestedObjectLocator = page
        .getByLabel('nested_object', { exact: true })
        .getByRole('button', { name: '▶' });
      await expandNestedObjectLocator.first().click();

      // Filter by url
      await page.getByLabel(/Include log lines containing url=".+"/).click();
      await expect(page.getByLabel('Edit filter with key nested_object_url')).toHaveCount(1);
      await expect(page.getByText('[] 1 item')).toHaveCount(1);

      // Open DeeplyNestedObject
      await page.getByLabel('DeeplyNestedObject', { exact: true }).getByRole('button', { name: '▶' }).click();

      // Filter by URL
      await page
        .getByLabel(/Include log lines containing url=".+"/)
        .last()
        .click();
      await expect(page.getByLabel('Edit filter with key nested_object_DeeplyNestedObject_url')).toHaveCount(1);

      // Exclude last line
      await page
        .getByLabel(/Exclude log lines containing method=".+"/)
        .last()
        .click();

      // Should be no results
      await expect(page.getByText('[] 0 items')).toHaveCount(1);
    });
    test('can drill into nested nodes', async ({ page }) => {
      await explorePage.goToLogsTab();
      await explorePage.getJsonToggleLocator().click();

      // Drilldown into nested_node
      await page.getByLabel('Set nested_object as root node').first().click();
      await expect(page.getByLabel(/Include log lines containing url=".+"/)).toHaveCount(EXPANDED_NODE_COUNT);

      // Add filter from new root
      await page
        .getByLabel(/Include log lines containing url=".+"/)
        .first()
        .click();
      await expect(page.getByLabel('Edit filter with key nested_object_url')).toHaveCount(1);
      await expect(page.getByLabel(/Include log lines containing url=".+"/).first()).toHaveAttribute(
        'aria-selected',
        'true'
      );

      // Drill down again into DeeplyNestedObject
      await page.getByLabel('Set DeeplyNestedObject as root node').first().click();
      await expect(page.getByLabel(/Include log lines containing url=".+"/)).toHaveAttribute('aria-selected', 'false');
      await page
        .getByLabel(/Include log lines containing url=".+"/)
        .first()
        .click();
      await expect(page.getByLabel('Edit filter with key nested_object_DeeplyNestedObject_url')).toHaveCount(1);
      await expect(page.getByLabel(/Include log lines containing url=".+"/)).toHaveAttribute('aria-selected', 'true');

      // re-root
      await page.getByLabel('Set root as root node').click();
      // Open nested_object
      await page.getByLabel('nested_object', { exact: true }).getByRole('button', { name: '▶' }).click();
      await page.getByLabel('DeeplyNestedObject', { exact: true }).getByRole('button', { name: '▶' }).click();

      // Both url nodes should have active filter state
      await expect(page.getByLabel(/Include log lines containing url=".+"/)).toHaveCount(2);
      await expect(page.getByLabel(/Include log lines containing url=".+"/).first()).toHaveAttribute(
        'aria-selected',
        'true'
      );
      await expect(page.getByLabel(/Include log lines containing url=".+"/).last()).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });
    test('can filter nested props and drill back to root without removing json parser prop for active filters', async ({
      page,
    }) => {
      await explorePage.goToLogsTab();
      await explorePage.getJsonToggleLocator().click();

      // Expand all nested objects
      await page.getByLabel('nested_object', { exact: true }).first().getByRole('button', { name: '▶' }).click();
      await page.getByLabel('DeeplyNestedObject', { exact: true }).first().getByRole('button', { name: '▶' }).click();
      await page
        .getByLabel('ExtraDeeplyNestedObject', { exact: true })
        .first()
        .getByRole('button', { name: '▶' })
        .click();

      // Filter all nested objects
      await page.getByLabel('Include log lines that contain nested_object').first().click();
      await page.getByLabel('Include log lines that contain DeeplyNestedObject').first().click();
      await page.getByLabel('Include log lines that contain ExtraDeeplyNestedObject').first().click();
      await expect(page.getByText('{} 11 keys')).toHaveCount(EXPANDED_NODE_COUNT);

      // Drill into child
      await page.getByLabel('ExtraDeeplyNestedObject', { exact: true }).getByLabel('Set numArray as root node').click();
      await expect(page.getByText('[] 3 items')).toHaveCount(EXPANDED_NODE_COUNT);

      // Drill up to the root
      await page.getByLabel('Set root as root node').click();

      // Assert we still have results
      await expect(page.getByText('{} 11 keys')).toHaveCount(EXPANDED_NODE_COUNT);
    });
  });
});

const EXPANDED_NODE_COUNT = 50;
