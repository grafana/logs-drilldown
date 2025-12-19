import { expect, test } from '@grafana/plugin-e2e';

import { ExplorePage } from './fixtures/explore';

test.describe('Default fields', () => {
  let explorePage: ExplorePage;
  test.beforeEach(async ({ page }, testInfo) => {
    explorePage = new ExplorePage(page, testInfo);

    await explorePage.setExtraTallViewportSize();
    await explorePage.clearLocalStorage();
    await page.goto('/grafana/plugins/grafana-lokiexplore-app');
    await page.getByText('Default fields').click();
    await expect(page.getByText('Configure default fields to')).toBeVisible();
    await expect(page.getByText('Experimental')).toBeVisible();
    const deleteButtons = page.getByRole('button', { name: 'Delete record' });
    const deleteButtonsCount = await deleteButtons.count();
    explorePage.captureConsoleLogs();

    // Delete all existing records that may have persisted from other test executions
    for (let i = 0; i < deleteButtonsCount; i++) {
      await deleteButtons.nth(i).click();
    }

    const submitButton = page.getByRole('button', { name: /(Update|Create) default columns/ });
    const isDisabled = await submitButton.isDisabled();
    if (!isDisabled) {
      await submitButton.click();
    }
  });

  // @todo remove when 12.4 is released
  test.describe('< 12.4', () => {
    test('should show unsupported UI', async ({ page }) => {
      // We are running an old version of Grafana so we should see a message telling us to upgrade
      await expect(page.getByText('Default columns requires Grafana 12.4 or greater.')).toBeVisible();
      // But we have the right feature flags set, so we shouldn't see these
      await expect(page.getByText('kubernetesLogsDrilldown')).not.toBeVisible();
    });
  });

  test.describe.skip('>= 12.4', () => {
    test('can add new config', async ({ page }) => {
      const apacheServiceLogLineIdentifier = /HTTP\/[1|2].[0|1]/;
      // Create a new empty record
      await explorePage.defaultColumnsAdminAddNewRecord();
      // Pick service_name as a key
      await explorePage.defaultColumnsAdminAddLabelName('service_name');
      // Pick apache as a value
      await explorePage.defaultColumnsAdminAddLabelValue('apache');
      // Logs panel should show samples after selecting label value, apache logs always have HTTP protocol string
      await expect(page.getByText(apacheServiceLogLineIdentifier).first()).toBeInViewport();
      // Add traceID column
      await explorePage.defaultColumnsAdminAddColumn(
        'traceID',
        /[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}/
      );
      // Verify traceID is showing up in logs sample
      await expect(page.getByText(apacheServiceLogLineIdentifier).first()).not.toBeVisible();
      // Add namespace column
      await explorePage.defaultColumnsAdminAddColumn('namespace', 'gateway');
    });
  });
});
