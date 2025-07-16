import { expect, test } from '@grafana/plugin-e2e';

import { LokiQuery } from '../src/services/lokiQuery';
import { testIds } from '../src/services/testIds';
import { E2EComboboxStrings, ExplorePage, PlaywrightRequest } from './fixtures/explore';

const selectedButtonColor = 'rgb(110, 159, 255)';
const fieldName = 'method';
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
            `sum by (${fieldName}) (count_over_time({service_name="nginx-json"} | json method="[\\"method\\"]" | drop __error__, __error_details__ | ${fieldName}!=""`.replace(
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
    test.beforeEach(async ({ page }) => {
      // Playwright click automatically scrolls the element to the top of the container, but since we have sticky header this means every click fails (but somehow only when the trace is disabled)
      // So we inject some custom styles to disable the sticky header
      // Ideally we could specify a scroll offset, or have any control over this behavior in playwright, but for now we will weaken these tests instead of always failing when the test is executed without the trace.
      await page.addStyleTag({
        content: '[role="tree"] > li > ul > li > span, [role="tree"] > li > span {position: static !important;}',
      });
    });
    test('can filter top level props', async ({ page }) => {
      await explorePage.goToLogsTab();
      await explorePage.getJsonToggleLocator().click();

      // add some include filters
      const userIdentifierInclude = page.getByLabel(/Include log lines containing user-identifier=".+"/);
      await expect(userIdentifierInclude).toHaveCount(EXPANDED_NODE_COUNT); // 50 nodes are expanded by default
      await userIdentifierInclude.first().click();
      await expect(page.getByLabel('Edit filter with key user_identifier')).toHaveCount(1);

      const dateTimeInclude = page.getByLabel(/Include log lines containing datetime=".+"/);
      // This flakes sometimes locally, looks like playwright scrolls datetime under the sticky header before it tries to click
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
      await expect(page.getByText('No labels match these filters. ')).toHaveCount(1);
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
      await expect(page.getByText('▶Line:')).toHaveCount(1);

      // Open DeeplyNestedObject
      await page.getByLabel('deeplyNestedObject', { exact: true }).getByRole('button', { name: '▶' }).click();

      // Filter by URL
      await page
        .getByLabel(/Include log lines containing url=".+"/)
        .last()
        .click();
      await expect(page.getByLabel('Edit filter with key nested_object_deeplyNestedObject_url')).toHaveCount(1);

      // Exclude last line
      await page
        .getByLabel(/Exclude log lines containing method=".+"/)
        .last()
        .click();

      // Should be no results
      await expect(page.getByText('No labels match these filters.')).toHaveCount(1);
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
      // Don't love checking a specific CSS property, but the primary color shouldn't change any time soon, and #1412 broke the selected color by applying another color style
      await expect(page.getByLabel(/Include log lines containing url=".+"/).first()).toHaveCSS(
        'color',
        selectedButtonColor
      );

      // Drill down again into DeeplyNestedObject
      await page.getByLabel('Set deeplyNestedObject as root node').first().click();
      await expect(page.getByLabel(/Include log lines containing url=".+"/)).toHaveCount(1);
      await expect(page.getByLabel(/Include log lines containing url=".+"/)).toHaveAttribute('aria-selected', 'false');
      await page
        .getByLabel(/Include log lines containing url=".+"/)
        .first()
        .click();
      await expect(page.getByLabel('Edit filter with key nested_object_deeplyNestedObject_url')).toHaveCount(1);
      await expect(page.getByLabel(/Include log lines containing url=".+"/)).toHaveCount(1);
      await expect(page.getByLabel(/Include log lines containing url=".+"/)).toHaveAttribute('aria-selected', 'true');

      // re-root
      await page.getByRole('button', { exact: true, name: 'root' }).click();
      // Open nested_object
      await page.getByLabel('nested_object', { exact: true }).getByRole('button', { name: '▶' }).click();
      await page.getByLabel('deeplyNestedObject', { exact: true }).getByRole('button', { name: '▶' }).click();

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
      await page.getByLabel('deeplyNestedObject', { exact: true }).first().getByRole('button', { name: '▶' }).click();
      await page
        .getByLabel('extraDeeplyNestedObject', { exact: true })
        .first()
        .getByRole('button', { name: '▶' })
        .click();

      // Filter all nested objects
      await page.getByLabel('Include log lines that contain nested_object').first().click();
      await expect(page.getByLabel('Include log lines that contain nested_object').first()).toHaveAttribute(
        'aria-selected',
        'true'
      );
      await expect(page.getByLabel('Include log lines that contain nested_object').first()).toHaveCSS(
        'color',
        selectedButtonColor
      );
      await page.getByLabel('Include log lines that contain deeplyNestedObject').first().click();
      await page.getByLabel('Include log lines that contain extraDeeplyNestedObject').first().click();
      await expect(page.getByText('▶Line:')).toHaveCount(EXPANDED_NODE_COUNT);

      // Drill into child
      await page.getByLabel('extraDeeplyNestedObject', { exact: true }).getByLabel('Set numArray as root node').click();
      await expect(page.getByText('▶Line:')).toHaveCount(EXPANDED_NODE_COUNT);

      // Drill up to the root
      await page.getByRole('button', { exact: true, name: 'root' }).click();

      // Assert we still have results
      await expect(page.getByText('▶Line:')).toHaveCount(EXPANDED_NODE_COUNT);
    });
    test('detected fields is called on init when loading json panel', async ({ page }) => {
      // Load logs tab
      await explorePage.goToLogsTab();
      // Switch to json viz
      await explorePage.getJsonToggleLocator().click();
      // Reload the page
      await page.reload();
      // Verify filter buttons are visible
      const userIdentifierInclude = page.getByLabel(/Include log lines containing user-identifier=".+"/);
      await expect(userIdentifierInclude).toHaveCount(EXPANDED_NODE_COUNT); // 50 nodes are expanded by default
    });

    test('detected fields is called after nav from fields page', async ({ page }) => {
      // Set JSON as default viz
      await explorePage.goToLogsTab();
      await explorePage.getJsonToggleLocator().click();
      // assert logs is active
      await expect(page.getByRole('radio', { name: 'JSON' })).toBeChecked();
      await explorePage.goToFieldsTab();
      // Clear caches
      await page.reload();

      // Go to fields tab after detected_fields was called on fields
      await explorePage.goToLogsTab();

      // Verify filter buttons are visible
      const userIdentifierInclude = page.getByLabel(/Include log lines containing user-identifier=".+"/);
      await expect(userIdentifierInclude).toHaveCount(EXPANDED_NODE_COUNT); // 50 nodes are expanded by default
    });

    test('can filter levels', async ({ page }) => {
      await explorePage.goToLogsTab();
      await explorePage.getJsonToggleLocator().click();

      // Show metadata node
      await page.getByRole('button', { name: 'Show structured metadata' }).click();
      await expect(page.getByText('Metadata', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('All levels')).toHaveCount(1);
      await page
        .getByLabel(/Include log lines containing detected_level=".+"/)
        .first()
        .click();

      await expect(page.getByText('All levels')).toHaveCount(0);
      await expect(
        page.getByTestId('data-testid detected_level filter variable').getByText(/debug|error|info|warn/)
      ).toHaveCount(1);
    });

    test('can filter labels', async ({ page }) => {
      await explorePage.goToLogsTab();
      await explorePage.getJsonToggleLocator().click();

      //show labels node
      await page.getByRole('button', { name: 'Show labels' }).click();
      await expect(page.getByText('Labels', { exact: true }).first()).toBeVisible();

      // assert already selected label filter is active
      await expect(page.getByLabel('Include log lines containing service_name="nginx-json"').first()).toHaveAttribute(
        'aria-selected',
        'true'
      );

      // select namespace
      await page
        .getByLabel(/Include log lines containing namespace=".+"/)
        .first()
        .click();

      // assert on namespace filter
      await expect(page.getByRole('button', { name: 'Edit filter with key namespace' })).toHaveCount(1);
    });

    test('line filters wrap matches in mark tag', async ({ page }) => {
      await explorePage.goToLogsTab();
      await explorePage.getJsonToggleLocator().click();

      // Highlight method (json label) and PATCH (json value)
      await page.getByTestId(testIds.exploreServiceDetails.searchLogs).fill('method');
      await page.getByRole('button', { exact: true, name: 'Include' }).click();
      await explorePage.assertTabsNotLoading();
      await explorePage.assertPanelsNotLoading();

      // Should not be visible until highlighting is clicked
      await expect(page.locator('mark', { hasText: 'method' })).toHaveCount(0);
      // Enable highlighting
      await page.getByRole('button', { name: 'Enable highlighting' }).click();
      await expect(page.locator('mark', { hasText: 'method' }).first()).toBeVisible();
    });

    test('level is visible in line item string, filterable', async ({ page }) => {
      await explorePage.goToLogsTab();
      await explorePage.getJsonToggleLocator().click();
      await expect(
        page.getByTestId('data-testid detected_level filter variable').getByText('All levels')
      ).toBeVisible();
      await page
        .getByRole('treeitem')
        .first()
        .getByRole('button', { name: /INFO|DEBUG|WARN|ERROR/ })
        .first()
        .click();
      await expect(page.getByTestId('data-testid detected_level filter variable').getByText('All levels')).toHaveCount(
        0
      );
      // Verify something has been added to detected_level variable
      await expect(
        page.getByTestId('data-testid detected_level filter variable').getByRole('button', { name: 'Remove' })
      ).toHaveCount(1);
    });

    test('can share link to log line', async ({ page }) => {
      // Need to make sure we have >100 logs so we start with a 3-minute interval
      await explorePage.gotoServicesBreakdownOldUrl('nginx-json', 'now-3m');
      await explorePage.setDefaultViewportSize();
      await explorePage.goToLogsTab();
      await explorePage.getJsonToggleLocator().click();
      const copyLinkToLogLineLoc = page.getByLabel('Copy link to log line');

      // Get the initial count of log lines
      const initialLinesCount = await copyLinkToLogLineLoc.count();
      // Expand more logs past the initial 50 so we can assert that the JSON viz will automatically expand nodes when we have scrollTo set
      await page.getByRole('button', { name: '▶ ▶' }).first().click();
      // Get the count of log lines after expanding a section
      const expandedLinesCount = await copyLinkToLogLineLoc.count();
      // Calculate an index that will have been collapsed before we expanded the collection
      const selectedIndex = initialLinesCount + Math.floor((expandedLinesCount - initialLinesCount) / 2);
      // Get the button that creates a link to this line
      const selectedCopyLinkToLogLineLoc = copyLinkToLogLineLoc.nth(selectedIndex);
      // Get the parent element
      const selectedLogLineLoc = page.getByRole('treeitem', { name: selectedIndex.toString(), exact: true });
      // Grab all text within the log line
      const selectedLogLineText = await selectedLogLineLoc.textContent();
      // Copy the log line link to clipboard
      await selectedCopyLinkToLogLineLoc.click();
      // Get text from clipboard
      const handle = await page.evaluateHandle(() => navigator.clipboard.readText());
      const clipboardContent = await handle.jsonValue();
      // Navigate to url from clipboard
      await page.goto(clipboardContent);
      // Assert that the Line we copied is in the viewport, and all the k/v exactly match
      await expect(page.getByText(selectedLogLineText ?? '')).toBeInViewport();
    });

    test('derived field links', async ({ page, context }) => {
      await explorePage.goToLogsTab();
      await explorePage.getJsonToggleLocator().click();
      // Show metadata
      await page.getByRole('button', { name: 'Show structured metadata' }).click();
      // Assert the links exist
      await expect(page.getByRole('link', { name: 'traceID-tempo' }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: 'traceID-jaeger' }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: 'traceID-zipkin' }).first()).toBeVisible();

      // Get the traceID string
      const traceIdLoc = page
        .getByText(/traceID:.*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)
        .first();
      const traceId = (await traceIdLoc.textContent())?.split(':')?.[1];
      if (!traceId) {
        throw new Error('No trace ID found.');
      }

      const href = await page.getByRole('link', { name: 'traceID-tempo' }).first().getAttribute('href');
      expect(href).toContain(traceId);
    });
  });
});

const EXPANDED_NODE_COUNT = 50;
