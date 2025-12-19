import { expect, test } from '@grafana/plugin-e2e';

import { testIds } from '../src/services/testIds';
import { ExplorePage } from './fixtures/explore';

test.describe('Default fields', () => {
  let explorePage: ExplorePage;
  test.beforeEach(async ({ page }, testInfo) => {
    explorePage = new ExplorePage(page, testInfo);

    await explorePage.setExtraTallViewportSize();
    await explorePage.clearLocalStorage();
    explorePage.blockAllQueriesExcept({
      refIds: ['logsPanelQuery', /gld-sample-\d+/, /^logs-.+/],
    });
    await page.goto('/grafana/plugins/grafana-lokiexplore-app');
    await page.getByText('Default fields').click();
    await expect(page.getByText('Configure default fields to')).toBeVisible();
    await expect(page.getByText('Experimental')).toBeVisible();
    explorePage.captureConsoleLogs();
  });

  // @todo remove when 12.4 is released
  test.describe.skip('< 12.4', () => {
    test('should show unsupported UI', async ({ page }) => {
      // We are running an old version of Grafana so we should see a message telling us to upgrade
      await expect(page.getByText('Default columns requires Grafana 12.4 or greater.')).toBeVisible();
      // But we have the right feature flags set, so we shouldn't see these
      await expect(page.getByText('kubernetesLogsDrilldown')).not.toBeVisible();
    });
  });

  test.describe('>= 12.4', () => {
    test.describe.configure({ mode: 'serial' });

    test.describe('can add config', () => {
      const apacheServiceLogLineIdentifier = /HTTP\/[1|2].[0|1]/;
      const nginxServiceLogLineIdentifier =
        /[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}.+\[[0-9]{1,2}\/[a-zA-Z]{3}\/[0-9]{4}:[0-9]{2}:[0-9]{2}:[0-9]{2}.+\+[0-9]{4}]/;
      const traceIdRegex = /[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}/;
      const clusterRegex = /(us|eu)-(west|east)-[12]/;
      const envRegex = /(prod|dev|staging|monitoring|infra)/;
      const levelRegex = /(debug|info|error|warn)/;
      const dateRegex = /(20[2-3][0-9]-[0-9]{1,2}-[0-9]{1,2}\s[0-2][0-9]:[0-9]{2}:[0-9]{2}\.[0-9]{3})/;
      const apachePodRegex = /(apache-[a-z0-9]{5})/;
      const namespaceRegex = /gateway/;
      const fullNginxRegex = new RegExp(
        dateRegex.source + '\\s' + levelRegex.source + '\\s' + envRegex.source + '\\s' + clusterRegex.source
      );
      const fullApacheRegex = new RegExp(
        dateRegex.source +
          '\\s' +
          levelRegex.source +
          '\\s' +
          traceIdRegex.source +
          '\\s' +
          namespaceRegex.source +
          '\\s' +
          clusterRegex.source
      );
      const fullApachePodRegex = new RegExp(
        dateRegex.source + '\\s' + levelRegex.source + '\\s' + apachePodRegex.source
      );

      test('1. can add new config', async ({ page }) => {
        await explorePage.defaultColumnsDeleteAllRecords();

        const submitButton = page.getByRole('button', { name: /(Update|Create) default columns/ });
        await expect(submitButton).toBeVisible();
        // Create a new empty record for service_name = apache
        await explorePage.defaultColumnsAdminAddNewRecord();
        await explorePage.defaultColumnsAdminAddLabelName('service_name');
        await explorePage.defaultColumnsAdminAddLabelValue('apache');
        // Logs panel should show samples after selecting label value, apache logs always have HTTP protocol string
        await expect(page.getByText(apacheServiceLogLineIdentifier).first()).toBeInViewport();
        // Add traceID column
        await explorePage.defaultColumnsAdminAddColumn('traceID', traceIdRegex);
        // Verify traceID is showing up in logs sample
        await expect(page.getByText(apacheServiceLogLineIdentifier).first()).not.toBeVisible();
        // Add namespace column
        await explorePage.defaultColumnsAdminAddColumn('namespace', 'gateway');
        // Add cluster column
        await explorePage.defaultColumnsAdminAddColumn('cluster', clusterRegex);

        // Create second record for service_name = nginx
        await explorePage.defaultColumnsAdminAddNewRecord();
        await explorePage.defaultColumnsAdminAddLabelName('service_name');
        await explorePage.defaultColumnsAdminAddLabelValue('nginx');
        // Logs panel should show samples of nginx logs
        await expect(page.getByText(nginxServiceLogLineIdentifier).first()).toBeVisible();
        await explorePage.defaultColumnsAdminAddColumn('env', envRegex);
        await explorePage.defaultColumnsAdminAddColumn(
          'cluster',
          new RegExp(envRegex.source + `\\s` + clusterRegex.source)
        );

        // Create third record combining both
        await explorePage.defaultColumnsAdminAddNewRecord();
        await explorePage.defaultColumnsAdminAddLabelName('service_name');
        await explorePage.defaultColumnsAdminAddLabelValue('apache');
        // add new label for nginx
        await explorePage.defaultColumnsAddNewLabel();
        await explorePage.defaultColumnsAdminAddLabelName('service_name');
        await explorePage.defaultColumnsAdminAddLabelValue('nginx');
        await explorePage.defaultColumnsAdminAddColumn('file', /C:\\Grafana\\logs\\gateway\.txt /);

        // Save results
        await expect(submitButton).not.toBeDisabled();
        await submitButton.click();
        await expect(submitButton).toBeDisabled();
      });
      test('2. can see default columns in service selection', async ({ page }) => {
        await explorePage.gotoServices();
        await explorePage.servicesSearch.click();
        await page.keyboard.type('apache|^nginx$');
        await page.keyboard.press('Escape');
        await expect(page.getByTestId(testIds.index.selectServiceButton)).toHaveCount(2);
        await expect(page.getByText(apacheServiceLogLineIdentifier)).not.toBeVisible();
        await expect(page.getByText(nginxServiceLogLineIdentifier)).not.toBeVisible();
        await expect(page.getByText(fullNginxRegex).first()).toBeVisible();
        await expect(page.getByText(fullApacheRegex).first()).toBeVisible();
      });
      test('3. can see default columns in service view - apache', async ({ page }) => {
        const showOriginalLogLineButton = page.getByText('Show original log line');
        const showDefaultFieldsButton = page.getByText('Show default fields');
        await explorePage.gotoServices();
        await explorePage.servicesSearch.click();
        await page.keyboard.type('apache');
        await page.keyboard.press('Escape');
        await expect(page.getByTestId(testIds.index.selectServiceButton)).toHaveCount(1);
        await page.getByTestId(testIds.index.selectServiceButton).click();
        await expect(showOriginalLogLineButton).toBeVisible();
        await showOriginalLogLineButton.hover();
        await expect
          .poll(() => page.getByText('Clear displayed fields: traceID, namespace, cluster').count())
          .toEqual(1);
        await expect(page.getByRole('checkbox', { name: 'traceID', exact: true })).toBeChecked();
        await expect(page.getByRole('checkbox', { name: 'namespace', exact: true })).toBeChecked();
        await expect(page.getByRole('checkbox', { name: 'cluster', exact: true })).toBeChecked();
        await expect(page.getByText(fullApacheRegex).first()).toBeVisible();
        await showOriginalLogLineButton.click();
        await page.pause();
        await expect(page.getByText(fullApacheRegex)).toHaveCount(0);
        await page.getByText('pod').click();
        await expect.poll(() => page.getByText(fullApachePodRegex).count()).toBeGreaterThanOrEqual(1);

        // Start over to verify user changes take precedence
        await explorePage.gotoServices();
        await explorePage.servicesSearch.click();
        await page.keyboard.type('apache');
        await page.keyboard.press('Escape');
        await expect(page.getByTestId(testIds.index.selectServiceButton)).toHaveCount(1);
        await page.getByTestId(testIds.index.selectServiceButton).click();
        await expect(page.getByText(fullApachePodRegex).first()).toBeVisible();
        await expect(showOriginalLogLineButton).toBeVisible();
        await expect(showDefaultFieldsButton).toBeVisible();
      });
      test('4. can see default columns in service view - nginx + apache', async ({ page }) => {
        const showOriginalLogLineButton = page.getByText('Show original log line');
        await explorePage.gotoServices();
        await explorePage.servicesSearch.click();
        await page.keyboard.type('apache|^nginx$');
        await page.keyboard.press('Escape');
        await expect(page.getByTestId(testIds.index.showLogsButton)).toHaveCount(2);
        await page.getByTestId(testIds.index.showLogsButton).first().click();
        await page.getByTestId(testIds.index.showLogsButton).last().click();
        await page.getByText('Show logs').click();
        await expect(showOriginalLogLineButton).toBeVisible();
        await expect(page.getByRole('checkbox', { name: 'file', exact: true })).toBeChecked();
        await expect(page.getByText('C:\\Grafana\\logs\\gateway.txt').first()).toBeVisible();
      });
    });
  });
});
