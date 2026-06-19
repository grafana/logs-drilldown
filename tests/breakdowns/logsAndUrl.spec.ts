import { expect, test } from '@grafana/plugin-e2e';

import { FilterOp } from '../../src/services/filterTypes';
import { testIds } from '../../src/services/testIds';
import { SERVICE_NAME } from '../../src/services/variables';
import { CapturedResponses, ComboBoxIndex, E2EComboboxStrings, ExplorePage } from '../fixtures/explore';

import { labelName, levelName, setupServiceBreakdownTest, teardownServiceBreakdownTest } from './shared';

test.describe('Logs and URL', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page, grafanaVersion }, testInfo) => {
    explorePage = await setupServiceBreakdownTest(page, grafanaVersion, testInfo);
  });

  test.afterEach(async () => {
    await teardownServiceBreakdownTest(explorePage);
  });

  test('should filter logs panel on search for broadcast field', async ({ page }) => {
    await explorePage.serviceBreakdownSearch.click();
    await explorePage.serviceBreakdownSearch.fill('broadcast');
    // Submit filter
    await explorePage.serviceBreakdownSearch.press('Enter');
    await expect(page.locator('.unwrapped-log-line').first().getByText('broadcast').first()).toBeVisible();
    await expect(page).toHaveURL(/broadcast/);
  });

  test(`should replace service_name with ${labelName} in url`, async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      legendFormats: [`{{${labelName}}}`, `{{service_name}}`],
      refIds: ['logsPanelQuery'],
    });
    // Navigate to labels aggregation view. Wait on the specific cluster control
    // below instead of broad tab-loading state, which can remain busy under
    // parallel E2E load while the target interaction is already available.
    await page.getByTestId(testIds.exploreServiceDetails.tabLabels).click();

    // Select cluster
    const selectClusterButton = page.getByLabel(`Select ${labelName}`);
    await expect(selectClusterButton).toHaveCount(1);
    await page.getByLabel(`Select ${labelName}`).click();

    // include eu-west-1 cluster. Locate the value panel via its accessible
    // role (`region`) which is reliably rendered before the legacy
    // `data-testid Panel header X` testid is attached. Use a generous timeout
    // because the LABEL_BREAKDOWN_VALUES query can be slow under parallel
    // E2E load.
    const includeCluster = 'eu-west-1';
    const clusterIncludeSelectButton = page
      .getByRole('region', { name: includeCluster })
      .getByTestId('data-testid button-filter-include');
    await expect(clusterIncludeSelectButton).toHaveCount(1, { timeout: 45000 });
    await clusterIncludeSelectButton.click();

    // include us-west-1 cluster
    const includeCluster2 = 'us-west-1';
    const cluster2IncludeSelectButton = page
      .getByRole('region', { name: includeCluster2 })
      .getByTestId('data-testid button-filter-include');
    await expect(cluster2IncludeSelectButton).toHaveCount(1);
    await cluster2IncludeSelectButton.click();

    // assert there are 2 includes selected
    await expect(clusterIncludeSelectButton).toHaveAttribute('aria-selected', 'true');
    await expect(cluster2IncludeSelectButton).toHaveAttribute('aria-selected', 'true');

    // exclude "us-east-1" cluster
    const excludeCluster = 'us-east-1';
    const clusterExcludeSelectButton = page
      .getByRole('region', { name: excludeCluster })
      .getByTestId('data-testid button-filter-exclude');
    await expect(clusterExcludeSelectButton).toHaveCount(1);
    await clusterExcludeSelectButton.click();

    // assert the includes were removed, exclude is shown
    await expect(clusterIncludeSelectButton).not.toHaveAttribute('aria-selected', 'true');
    await expect(cluster2IncludeSelectButton).not.toHaveAttribute('aria-selected', 'true');
    await expect(clusterExcludeSelectButton).toHaveAttribute('aria-selected', 'true');

    // Add an include which should remove exclude button
    await clusterIncludeSelectButton.click();
    await expect(clusterExcludeSelectButton).not.toHaveAttribute('aria-selected', 'true');
    await expect(clusterIncludeSelectButton).toHaveAttribute('aria-selected', 'true');

    // Navigate to labels tab. `goToLabelsTab` already asserts the tab strip is
    // ready, so we don't need an additional `assertTabsNotLoading()` after it.
    await explorePage.goToLabelsTab();

    // Include should navigate us back to labels tab
    await expect(selectClusterButton).toHaveCount(1);

    // Now remove service_name variable
    const removeServiceNameFilterBtn = page.getByLabel('Remove filter with key service_name');
    await expect(removeServiceNameFilterBtn).toHaveCount(1);
    await removeServiceNameFilterBtn.click();

    // Assert cluster has been added as the new URL slug. The URL change is the
    // canonical signal here; no need for a separate tab-loading wait.
    await expect(page).toHaveURL(/\/cluster\/eu-west-1\//);

    // Assert service_name is visible as a normal label
    const serviceNameSelect = page.getByLabel('Select service_name');
    await expect(serviceNameSelect).toHaveCount(1);
    await serviceNameSelect.click();

    // exclude nginx service. The `toHaveCount(1)` below already waits for the
    // panel to render, so the broad `assertNotLoading()` is redundant here.
    // Use `exact: true` because `name: 'nginx'` would also match `nginx-json`
    // and `nginx-json-mixed` panels via substring.
    const nginxExcludeBtn = page
      .getByRole('region', { name: 'nginx', exact: true })
      .getByTestId('data-testid button-filter-exclude');

    await expect(nginxExcludeBtn).toHaveCount(1, { timeout: 45000 });
    await nginxExcludeBtn.click();

    // Assert service name exclusion filter is visible
    const serviceNameFilter = page.getByLabel('Edit filter with key service_name');
    await expect(serviceNameFilter).toHaveCount(1);
    await expect(serviceNameFilter).toHaveText('service_name != nginx');
  });
  test(`combobox should replace service_name with regex ${labelName} in url`, async ({ page }) => {
    explorePage.blockAllQueriesExcept({
      refIds: ['LABEL_BREAKDOWN_VALUES'],
    });

    // Add custom value to combobox
    await explorePage.addCustomValueToCombobox(labelName, FilterOp.RegexEqual, ComboBoxIndex.labels, `us-.+`);

    // Remove current "primary" label used in the URL
    await page.getByLabel(E2EComboboxStrings.removeByKey(SERVICE_NAME)).click();

    // Assert cluster has been added as the new URL slug
    await expect(page).toHaveURL(/\/cluster\/us-\.%2B\//);

    // Navigate to labels aggregation view. Wait on the specific label controls below
    // instead of the broad page-wide loading assertion, which can catch unrelated
    // Grafana loading affordances under parallel E2E load.
    await page.getByTestId(testIds.exploreServiceDetails.tabLabels).click();

    // Assert service_name is visible as a normal label
    const clusterNameSelect = page.getByLabel('Select cluster');

    // Assert cluster is visible as a normal label
    const serviceNameSelect = page.getByLabel('Select service_name');

    await expect(serviceNameSelect).toHaveCount(1);
    await expect(clusterNameSelect).toHaveCount(1);

    // add service exclude
    await clusterNameSelect.click();

    // Assert all three us-.+ cluster value panels are showing. Use a longer
    // timeout since LABEL_BREAKDOWN_VALUES query can be slow under parallel
    // E2E load. Using heading+name regex matches the canonical panel header
    // even before the region's accessible name is computed.
    const usValuePanels = page.getByRole('heading', { name: /^us-(east|west)-\d$/ });
    await expect(usValuePanels).toHaveCount(3, { timeout: 45000 });

    // Assert there are only 4 panels (3 value panels + summary panel)
    await expect(page.getByRole('heading', { name: /^(cluster|us-east-1|us-east-2|us-west-1)$/ })).toHaveCount(4);

    // exclude us-east-1 cluster
    const usEastExcludeButton = page
      .getByRole('region', { name: 'us-east-1' })
      .getByTestId('data-testid button-filter-exclude');

    await expect(usEastExcludeButton).toHaveCount(1);
    await usEastExcludeButton.click();

    // Assert service name exclusion filter is visible
    const clusterExcludeFilter = page.getByLabel(E2EComboboxStrings.editByKey('cluster')).last();
    await expect(clusterExcludeFilter).toHaveCount(1);
    await expect(clusterExcludeFilter).toHaveText('cluster != us-east-1');

    // Assert remaining us-.+ cluster values are still showing
    await expect(page.getByRole('heading', { name: /^us-(east|west)-\d$/ })).toHaveCount(3);

    // Assert there are only 4 panels (3 value panels + summary panel)
    await expect(page.getByRole('heading', { name: /^(cluster|us-east-1|us-east-2|us-west-1)$/ })).toHaveCount(4);
  });
  test('should update a filter and run new logs', async ({ page }) => {
    await page.getByLabel('Edit filter with key').click();
    await page.getByText('mimir-distributor').click();

    // Assert the panel is done loading before going on
    await expect(page.getByTestId(testIds.logsPanelHeader.header).getByLabel('Panel loading bar')).toHaveCount(0);

    // @todo this test was flaking because the row is clicked before the logs panel renders the final rows. Potential grafana/grafana bug in the logs panel?
    // assert that the logs panel is done rendering
    await expect(page.getByText(/Rendering \d+ rows.../)).toHaveCount(0);

    // open log details
    await page.locator('.unwrapped-log-line').nth(1).click();

    await explorePage.scrollToBottom();
    // Target the ad-hoc filter chip specifically; with more data, "mimir-distributor" also appears in log line labels
    const adHocLocator = page
      .getByRole('button', { name: /Edit filter with key service_name/ })
      .filter({ hasText: 'mimir-distributor' });
    await expect(adHocLocator).toHaveCount(1);
    // find text corresponding text to match adhoc filter
    await expect(adHocLocator).toBeVisible();
  });
  test('should open logs context', async ({ page }) => {
    let responses: CapturedResponses = [];
    explorePage.blockAllQueriesExcept({
      legendFormats: [`{{${levelName}}}`],
      refIds: ['logsPanelQuery', /log-row-context-query.+/],
      responses: responses,
    });
    const logRow = page.locator('.unwrapped-log-line').nth(1);
    await expect(logRow).toHaveCount(1, { timeout: 45000 });
    await expect(page.getByText(/Rendering \d+ rows.../)).toHaveCount(0);

    await page.locator('.unwrapped-log-line').nth(10).hover();
    const logMenu = page.getByLabel('Log menu').first();
    await logMenu.click();
    await page.getByText('Show context').click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog.getByText('Log context')).toHaveCount(1);
    await expect(dialog.getByText('Log context')).toBeVisible();

    // Get the last request and assert it returned a 200
    const key = Object.keys(responses[responses.length - 1]);
    expect(responses[responses.length - 1][key[0]].results[key[0]].status).toBe(200);
  });
});
