import { expect, test } from '@grafana/plugin-e2e';

import pluginJson from '../src/plugin.json';
import { STATIC_FROM, STATIC_TO } from './config/constants';
import { skipUnlessLatestGrafana } from './config/grafana-versions-supported';
import { E2EComboboxStrings, ExplorePage } from './fixtures/explore';

test.describe('navigating app', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page, grafanaVersion }, testInfo) => {
    skipUnlessLatestGrafana({ grafanaVersion });
    await page.evaluate(() => window.localStorage.clear());
    explorePage = new ExplorePage(page, testInfo);
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

    // The mega menu click resets `from`/`to` to the app default
    // (Components/Pages.tsx#DEFAULT_TIME_RANGE = `now-15m`/`now`). Against the
    // static-data e2e Loki snapshot that window is empty, so we override the
    // range back to the snapshot window before checking that service panels
    // render. The assertion below still verifies that everything *else* in
    // the URL matches the canonical reset shape.
    const resetParams = new URLSearchParams(page.url().split('?')[1]);
    const expectedSearchParams = new URLSearchParams(
      '?patterns=%5B%5D&from=now-15m&to=now&var-all-fields=&var-ds=gdev-loki&var-filters=&var-jsonFields&var-fields=&var-levels=&var-patterns=&var-lineFilterV2=&var-lineFilters=&var-lineFormat=&var-metadata=&timezone=browser&var-primary_label=service_name%7C%3D~%7C.%2B'
    );
    resetParams.sort();
    expectedSearchParams.sort();
    expect(resetParams.toString()).toEqual(expectedSearchParams.toString());

    resetParams.set('from', STATIC_FROM);
    resetParams.set('to', STATIC_TO);
    await page.goto(`/a/${pluginJson.id}/explore?${resetParams.toString()}`);
    await expect.poll(() => page.getByTestId('data-testid button-filter-include').first().count()).toEqual(1);
  });

  // Looks like mega menu clicks no longer trigger navigation, so whatever scene state is persisted after clicking on mega menu
  test('mega menu click should persist url params', async ({ page }) => {
    await explorePage.gotoServices();

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
