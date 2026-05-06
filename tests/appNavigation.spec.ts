import { expect, test } from '@grafana/plugin-e2e';

import pluginJson from '../src/plugin.json';
import { skipUnlessLatestGrafana } from './config/grafana-versions-supported';
import { E2EComboboxStrings, ExplorePage } from './fixtures/explore';
import { mockExploreApi } from './fixtures/mockExploreApi';
import { loadServiceSelectionFilterTempoI } from './mocks/scenarios/loadServiceSelectionFilterTempoI';

test.describe('navigating app', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page, grafanaVersion }, testInfo) => {
    skipUnlessLatestGrafana({ grafanaVersion });
    await page.evaluate(() => window.localStorage.clear());
    explorePage = new ExplorePage(page, testInfo);
    await mockExploreApi(page);
  });

  test('explore page should render successfully', async ({ page }) => {
    await page.goto(`/a/${pluginJson.id}/explore`);
    await expect(page.getByText('Data source')).toBeVisible();
  });

  test('mega menu click should reset url params (deprecated url)', async ({ page }) => {
    await explorePage.gotoServicesBreakdownOldUrl();

    await page.getByTestId('data-testid navigation mega-menu').getByRole('link', { name: 'Logs' }).click();
    await expect(page).toHaveURL(/a\/grafana\-lokiexplore\-app\/explore\?patterns\=%5B%5D/);
    await expect(page).toHaveURL(/var-primary_label=service_name/);
    await expect.poll(() => page.getByTestId('data-testid button-filter-include').first().count()).toEqual(1);

    // assert panels are showing
    // The mega menu click resets the URL params to the plugin's
    // DEFAULT_TIME_RANGE (`now-15m`/`now`), so the expected query string
    // uses relative time even though we navigated in with an absolute
    // snapshot range via `gotoServicesBreakdownOldUrl`. That reset is
    // exactly what this test is asserting.
    const actualSearchParams = new URLSearchParams(page.url().split('?')[1]);
    const expectedSearchParams = new URLSearchParams(
      '?patterns=%5B%5D&from=now-15m&to=now&var-all-fields=&var-ds=gdev-loki&var-filters=&var-jsonFields&var-fields=&var-levels=&var-patterns=&var-lineFilterV2=&var-lineFilters=&var-lineFormat=&var-metadata=&timezone=browser&var-primary_label=service_name%7C%3D~%7C.%2B'
    );
    actualSearchParams.sort();
    expectedSearchParams.sort();
    expect(actualSearchParams.toString()).toEqual(expectedSearchParams.toString());
  });

  // Looks like mega menu clicks no longer trigger navigation, so whatever scene state is persisted after clicking on mega menu
  test('mega menu click should persist url params', async ({ page }) => {
    // After typing `tempo-i` the next /index/volume call must return only the
    // tempo-ingester service so the assertions below work.
    await loadServiceSelectionFilterTempoI(page);
    await page.goto(`/a/${pluginJson.id}/explore`);

    // Primary label search uses regex; type a substring then confirm via the custom-value row (see wrapWildcardSearch in query.ts).
    await explorePage.servicesSearch.click();
    await explorePage.servicesSearch.pressSequentially('tempo-i');
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.getByRole('option').filter({ hasText: E2EComboboxStrings.customValueOptionHasText }).first().click();
    await expect(page.getByRole('heading', { name: 'tempo-ingester' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'tempo-distributor' })).not.toBeVisible();

    await explorePage.addServiceName();
    await explorePage.clickShowLogs();
    await page.getByTestId('data-testid navigation mega-menu').getByRole('link', { name: 'Logs' }).click();
    await expect(page).toHaveURL(/a\/grafana-lokiexplore-app\/explore\?patterns=%5B%5D/);

    // assert panels are showing
    await expect(page.getByTestId('data-testid button-filter-include').first()).toHaveCount(1);

    // assert the var-filters param contains the service name
    const varFilters = new URL(page.url()).searchParams.get('var-filters') ?? '';
    expect(varFilters).toContain('tempo-ingester');
  });
});
