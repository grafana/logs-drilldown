import { ConsoleMessage, Locator, Page, Request, TestInfo } from '@playwright/test';

import { DataFrameJSON } from '@grafana/data';
import { expect } from '@grafana/plugin-e2e';

import pluginJson from '../../src/plugin.json';
import { FilterOp, FilterOpType } from '../../src/services/filterTypes';
import { LokiQuery } from '../../src/services/lokiQuery';
import { testIds } from '../../src/services/testIds';
import { STATIC_FROM, STATIC_TO } from '../config/constants';

export type CapturedResponses = CapturedResponse[];

export type CapturedResponse = {
  [refId: string]: {
    results: {
      [refId: string]: {
        frames: DataFrameJSON[];
        status: number;
      };
    };
    status: number;
  };
};

export interface PlaywrightRequest {
  post: any;
  url: string;
}

function tryGetLokiQueriesFromRequest(request: Request): LokiQuery[] {
  try {
    const post = request.postDataJSON() as { queries?: unknown };
    return Array.isArray(post?.queries) ? (post.queries as LokiQuery[]) : [];
  } catch {
    return [];
  }
}

function isBatchDataQueryRequestUrl(url: string): boolean {
  return url.includes('ds/query');
}

export class ExplorePage {
  readonly firstServicePageSelect: Locator;
  logVolumeGraph: Locator;
  servicesSearch: Locator;
  serviceBreakdownSearch: Locator;
  serviceBreakdownOpenExplore: Locator;
  refreshPicker: Locator;
  logs: Array<{ msg: ConsoleMessage; type: string }> = [];

  constructor(
    public readonly page: Page,
    public readonly testInfo: TestInfo
  ) {
    this.firstServicePageSelect = this.page.getByTestId(testIds.index.showLogsButton).first();
    this.logVolumeGraph = this.page.getByText('Log volume');
    this.servicesSearch = this.page.getByTestId(testIds.exploreServiceSearch.search);
    this.serviceBreakdownSearch = this.page.getByTestId(testIds.exploreServiceDetails.searchLogs);
    this.serviceBreakdownOpenExplore = this.page.getByTestId(testIds.exploreServiceDetails.openExplore);
    this.refreshPicker = this.page.getByTestId(testIds.header.refreshPicker);
  }

  /**
   * Toolbar for the main logs viz (Logs / Table / JSON radios + Grafana logs controls when
   * `showControls` is on). Do not scope to `Panel header Logs` alone — sort/wrap live outside
   * that strip on current Grafana builds.
   */
  getLogsVisualizationToolbar() {
    const withLogsAndTableRadios = (candidates: Locator) =>
      candidates
        .filter({ has: this.page.getByRole('radio', { name: 'Logs', exact: true }) })
        .filter({ has: this.page.getByRole('radio', { name: 'Table', exact: true }) });

    return withLogsAndTableRadios(this.page.getByRole('region'))
      .or(withLogsAndTableRadios(this.page.locator('section')))
      .first();
  }

  getTableToggleLocator() {
    return this.getLogsVisualizationToolbar().getByRole('radio', { name: 'Table', exact: true });
  }

  getJsonToggleLocator() {
    return this.getLogsVisualizationToolbar().getByRole('radio', { name: 'JSON', exact: true });
  }

  getLogsToggleLocator() {
    return this.getLogsVisualizationToolbar().getByRole('radio', { name: 'Logs', exact: true });
  }

  getPanelContentLocator() {
    return this.page.getByTestId('data-testid panel content');
  }

  getLogsPanelLocator() {
    return this.page.getByTestId(new RegExp(testIds.logsPanelHeader.header)).first();
  }

  getLogsVolumePanelLocator() {
    return this.page.getByTestId(/data-testid Panel menu Logs/);
  }

  getLogsPanelContentLocator() {
    const chained = this.getLogsPanelLocator().getByTestId('data-testid panel content');
    const withRadios = this.page
      .getByTestId('data-testid panel content')
      .filter({ has: this.page.getByRole('radio', { name: 'Logs', exact: true }) });
    return withRadios.or(chained).first();
  }

  getLogsPanelRow(n = 0) {
    const content = this.getLogsPanelContentLocator();
    // Logs viz: virtualized rows (`data-log-index`). Table viz: `<tr>` with cells.
    return content.locator('[data-log-index]').nth(n).or(content.locator('tr:has(td)').nth(n));
  }

  /**
   * Timestamp cell: table mode uses the 3rd `td`. Logs viz uses the first field whose class
   * includes `level-` (e.g. `level-error field` / `level-info field`) next to the log line.
   */
  getLogsPanelRowTimestampLocator(rowIndex: number) {
    const content = this.getLogsPanelContentLocator();
    const virtualRow = content.locator('[data-log-index]').nth(rowIndex);
    const logsVizTimestamp = virtualRow.locator('.field[class*="level-"]').first();
    const tableTimestamp = content.locator('tr:has(td)').nth(rowIndex).locator('td').nth(2);
    return logsVizTimestamp.or(tableTimestamp);
  }

  /** Grafana logs toolbar: wrap control (`aria-label="Set line wrap"`). */
  getLogsWrapToggle() {
    return this.getLogsVisualizationToolbar().locator('button[aria-label="Set line wrap"]');
  }

  /** Assert wrap is off when the control exposes `aria-pressed` (plugin table controls). */
  async expectLogsWrapToolbarDefault() {
    const wrap = this.getLogsWrapToggle();
    await expect(wrap).toBeVisible();
    const pressed = await wrap.getAttribute('aria-pressed');
    if (pressed === 'true' || pressed === 'false') {
      await expect(wrap).toHaveAttribute('aria-pressed', 'false');
    }
  }

  async setLogsLineWrapMenu(enabled: boolean) {
    const btn = this.getLogsWrapToggle();
    await expect(btn).toBeVisible();

    // Grafana logs: `Set line wrap` keeps `aria-pressed="false"` while off — first click only opens
    // the menu; we must pick the menuitem (see `role="menu"` + `button[role="menuitem"]`).
    if ((await btn.getAttribute('aria-label')) === 'Set line wrap') {
      await btn.click();
      const choice = enabled ? 'Enable line wrapping' : 'Disable line wrapping';
      const menu = this.page.locator('[role="menu"]').filter({ hasText: choice }).last();
      await expect(menu).toBeVisible();
      await menu.getByRole('menuitem', { name: choice, exact: true }).click();
      return;
    }

    const pressed = await btn.getAttribute('aria-pressed');
    if (pressed === 'true' || pressed === 'false') {
      if ((pressed === 'true') !== enabled) {
        await btn.click();
      }
    }
  }

  /**
   * Sort “newest first” is active: Grafana core shows `Sorted by newest logs first`; table/JSON
   * use our `LogListControls` (`Set oldest logs first`); legacy header uses `Newest first` radio.
   */
  getLogsDirectionNewestFirstLocator() {
    const toolbar = this.getLogsVisualizationToolbar();
    return toolbar
      .getByRole('button', {
        name: /Sorted by newest logs first|Set oldest logs first/i,
      })
      .or(toolbar.getByRole('radio', { name: 'Newest first', exact: true }))
      .first();
  }

  getLogsDirectionOldestFirstLocator() {
    const toolbar = this.getLogsVisualizationToolbar();
    return toolbar
      .getByRole('button', {
        name: /Sorted by oldest logs first|Set newest logs first/i,
      })
      .or(toolbar.getByRole('radio', { name: 'Oldest first', exact: true }))
      .first();
  }

  captureConsoleLogs() {
    this.page.on('console', (msg) => {
      this.logs.push({ msg, type: msg.type() });
    });
  }

  echoConsoleLogsOnRetry() {
    if (this.testInfo.retry > 0) {
      console.log('logs', this.logs);
    }
  }

  async aggregatedMetricsToggle() {
    const menuOpenBtn = this.page.getByTestId(testIds.index.aggregatedMetricsMenu);
    await expect(menuOpenBtn).toHaveCount(1);
    await menuOpenBtn.click();

    const aggregatedMetricsToggleBtn = this.page.getByLabel('Toggle aggregated metrics');
    await expect(aggregatedMetricsToggleBtn).toHaveCount(1);
    await aggregatedMetricsToggleBtn.click();
  }

  async clearLocalStorage() {
    await this.page.evaluate(() => window.localStorage.clear());
  }

  async setDefaultViewportSize() {
    await this.page.setViewportSize({ height: 680, width: 1280 });
  }

  async setExtraTallViewportSize() {
    await this.page.setViewportSize({
      height: 3000,
      width: 1280,
    });
  }

  /**
   * Clears any custom routes created with page.route
   */
  async unroute() {
    await this.page.unrouteAll({ behavior: 'ignoreErrors' });
  }

  async gotoServices(opts: { from?: string; to?: string } = {}) {
    const params = new URLSearchParams({
      from: opts.from ?? STATIC_FROM,
      to: opts.to ?? STATIC_TO,
      'var-ds': 'gdev-loki',
      timezone: 'utc',
    });
    await this.page.goto(`/a/${pluginJson.id}/explore?${params.toString()}`);
  }

  async addServiceName() {
    await this.firstServicePageSelect.click();
  }

  async clickShowLogs() {
    await this.page.getByTestId('data-testid Show logs header').click();
  }

  /**
   * Changes the datasource from gdev-loki to gdev-loki-copy
   */
  async changeDatasource(sourceUID = 'gdev-loki', targetUID = 'gdev-loki-copy') {
    await this.page
      .locator('div')
      .filter({ hasText: new RegExp(`^${sourceUID}$`) })
      .nth(1)
      .click();
    await this.page.getByText(targetUID).click();
  }

  async scrollToBottom() {
    const main = this.page.locator('html');

    // Scroll the page container to the bottom, smoothly
    await main.evaluate((main) => main.scrollTo({ behavior: 'smooth', left: 0, top: main.scrollHeight }));
  }

  async goToLogsTab() {
    await this.page.getByTestId(testIds.exploreServiceDetails.tabLogs).click();
    await this.assertNotLoading();
    await this.assertTabsNotLoading();
  }

  async goToFieldsTab() {
    await this.page.getByTestId(testIds.exploreServiceDetails.tabFields).click();
    await this.assertNotLoading();
    await this.assertTabsNotLoading();
  }

  async goToLabelsTab() {
    await this.page.getByTestId(testIds.exploreServiceDetails.tabLabels).click();
    await this.assertNotLoading();
    await this.assertTabsNotLoading();
  }

  async goToPatternsTab() {
    await this.page.getByTestId(testIds.exploreServiceDetails.tabPatterns).click();
    await this.assertNotLoading();
    await this.assertTabsNotLoading();
  }

  getAllPanelsLocator() {
    return this.page.getByTestId(/data-testid Panel header/).locator(this.getPanelHeaderLocator());
  }

  async assertNotLoading() {
    // Avoid broad /loading/i checks here: Grafana and Scenes can expose
    // unrelated loading labels while the snapshot-backed UI under test is ready.
    const locator = this.page.getByText(/^Loading(\.\.\.)?$/i);
    await expect(locator).toHaveCount(0);
  }

  async assertPanelsNotLoading() {
    await expect.poll(() => this.page.getByLabel('Panel loading bar').count()).toEqual(0);
    await this.page.waitForFunction(() => !document.querySelector('[title="Cancel query"]'));
  }

  async waitForRequest(
    init: () => Promise<any>,
    callback: (lokiQuery: LokiQuery) => void,
    test: (lokiQuery: LokiQuery) => boolean,
    options: { timeout?: number } = {}
  ) {
    // Default 30s: static snapshot keeps queries cheap, but parallel workers can make them noticeably slower.
    const { timeout = 30_000 } = options;

    let callbackInvoked = false;
    const tryMatch = (request: Request): boolean => {
      if (!isBatchDataQueryRequestUrl(request.url())) {
        return false;
      }
      const queries = tryGetLokiQueriesFromRequest(request);
      for (const q of queries) {
        if (test(q)) {
          if (!callbackInvoked) {
            callbackInvoked = true;
            callback(q);
          }
          return true;
        }
      }
      return false;
    };

    await Promise.all([init(), this.page.waitForRequest((req) => tryMatch(req), { timeout })]);
  }

  // This is flakey, panels won't show the state if the requests come back in < 75ms
  async assertPanelsLoading() {
    await expect(this.page.getByLabel('Panel loading bar').first()).toBeVisible();
  }

  getPanelHeaderLocator() {
    return this.page.getByTestId('data-testid header-container');
  }

  /** Service-selection grid row for `serviceName` (timeseries panel header with "Show logs" link). */
  getServiceSelectionRow(serviceName: string): Locator {
    const heading = this.page.getByRole('heading', { name: serviceName, exact: true });
    return this.getPanelHeaderLocator()
      .filter({ has: heading })
      .filter({ has: this.page.getByTestId(testIds.index.selectServiceButton) });
  }

  async clickSelectServiceShowLogsLink(serviceName: string) {
    await this.getServiceSelectionRow(serviceName).getByTestId(testIds.index.selectServiceButton).click();
  }

  getExploreCodeQueryLocator() {
    return this.page.getByRole('code').locator('div').filter({ hasText: 'sum' }).nth(3);
  }

  async assertTabsNotLoading() {
    const tabSelectors = [
      this.page.getByTestId(testIds.exploreServiceDetails.tabLogs),
      this.page.getByTestId(testIds.exploreServiceDetails.tabPatterns),
      this.page.getByTestId(testIds.exploreServiceDetails.tabLabels),
      this.page.getByTestId(testIds.exploreServiceDetails.tabFields),
    ];
    for (let loc of tabSelectors) {
      const tabsLoadingSelector = loc.filter({ has: this.page.locator('svg') });

      // Assert we can see the tabs. Use a generous timeout because this is
      // often the first post-navigation checkpoint and the SPA shell can take
      // longer to render under parallel E2E load.
      await expect(loc).toHaveCount(1, { timeout: 45000 });
      // Assert that the loading svg is not present
      await expect.poll(() => tabsLoadingSelector.count(), { timeout: 0 }).toEqual(0);
    }
  }

  async click(locator: Locator) {
    await expect(locator).toBeVisible();
    await locator.scrollIntoViewIfNeeded();
    await locator.click({ force: true });
  }

  async scrollToTop() {
    const main = this.page.locator('main#pageContent');

    // Scroll the page container to the bottom
    await main.evaluate((main) => main.scrollTo(0, 0));
  }

  async gotoServicesBreakdownOldUrl(serviceName = 'tempo-distributor', from = STATIC_FROM, to = STATIC_TO) {
    await this.page.goto(
      `/a/${pluginJson.id}/explore/service/tempo-distributor/logs?mode=service_details&patterns=[]&var-filters=service_name|=|${serviceName}&var-logsFormat= | logfmt&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    );
  }

  async gotoEmbedUrl() {
    // The embed scene builds its own datasource and query via
    // `getEmbeddedScene()` in `src/Components/Pages.tsx`. We only override
    // `from`/`to` so panel queries land inside the static-data Loki window;
    // we deliberately do NOT pass `var-ds` here because that variable is
    // owned by the embedded scene's internal wiring.
    const params = new URLSearchParams({
      from: STATIC_FROM,
      to: STATIC_TO,
      timezone: 'utc',
    });
    await this.page.goto(`/a/${pluginJson.id}/embed?${params.toString()}`);
  }

  async gotoServicesOldUrlLineFilters(
    serviceName = 'tempo-distributor',
    caseSensitive?: boolean,
    lineFilterValue = 'debug'
  ) {
    const range = `&from=${encodeURIComponent(STATIC_FROM)}&to=${encodeURIComponent(STATIC_TO)}`;
    if (caseSensitive) {
      await this.page.goto(
        // case insensitive
        `/a/${pluginJson.id}/explore/service/tempo-distributor/logs?mode=service_details&patterns=[]&var-lineFilter=%7C~%20%60%28%3Fi%29%60${lineFilterValue}%60&var-filters=service_name|=|${serviceName}&var-logsFormat= | logfmt${range}`
      );
    } else {
      await this.page.goto(
        // case insensitive
        `/a/${pluginJson.id}/explore/service/tempo-distributor/logs?mode=service_details&patterns=[]&var-lineFilter=%7C%3D%20%60${lineFilterValue}%60&var-filters=service_name|=|${serviceName}&var-logsFormat= | logfmt${range}`
      );
    }
  }

  async gotoLogsPanel(
    sortOrder: 'Ascending' | 'Descending' = 'Descending',
    wrapLogMessage: 'false' | 'true' = 'false'
  ) {
    const url = `/a/grafana-lokiexplore-app/explore/service/tempo-distributor/logs?patterns=[]&from=${encodeURIComponent(STATIC_FROM)}&to=${encodeURIComponent(STATIC_TO)}&var-all-fields=&var-ds=gdev-loki&var-filters=service_name|=|tempo-distributor&var-fields=&var-jsonFields=&var-lineFormat=&var-levels=&var-metadata=&var-patterns=&var-lineFilter=&timezone=utc&urlColumns=["Time","Line"]&visualizationType="logs"&displayedFields=[]&sortOrder="${sortOrder}"&wrapLogMessage=${wrapLogMessage}&var-lineFilterV2=&var-lineFilters=`;
    await this.page.goto(url);
  }

  blockAllQueriesExcept(options: {
    legendFormats?: string[];
    refIds?: Array<string | RegExp>;
    requests?: PlaywrightRequest[];
    responses?: CapturedResponses;
  }) {
    // Let's not wait for all these queries
    this.page.route('**/ds/query**', async (route) => {
      const request = route.request();
      const queries = tryGetLokiQueriesFromRequest(request);
      const refIdMatched = queries.find((q) => options?.refIds?.some((refIdToTarget) => q.refId?.match(refIdToTarget)));
      const legendMatched = queries.find(
        (q) => q.legendFormat != null && options?.legendFormats?.includes(q.legendFormat)
      );
      const matched = refIdMatched ?? legendMatched;
      const refId = matched?.refId;
      const legendFormat = matched?.legendFormat;

      if (matched) {
        if (options.responses || options.requests) {
          const response = await route.fetch();
          const json = await response.json();
          if (options.responses) {
            options?.responses?.push({ [refId ?? legendFormat ?? '']: json });
          }

          if (options?.requests) {
            const requestObject: PlaywrightRequest = {
              post: request.postDataJSON(),
              url: request.url(),
            };
            options?.requests?.push(requestObject);
          }

          await route.fulfill({ json, response });
        } else {
          await route.continue();
        }
      } else {
        await route.fulfill({ json: [] });
      }
    });
  }

  /**
   * Index scene: `VAR_FIELDS_AND_METADATA` sets placeholder `Filter by fields`; `VAR_FIELDS` ("Detected fields")
   * uses the scenes default `Filter by label values`, so the Fields-proxy placeholder is unique.
   * Grafana versions differ on whether the filter control is exposed as combobox name vs placeholder; use
   * a single union locator and always `.first()` on interaction to avoid duplicate strict violations.
   */
  private getIndexAdHocCombobox(comboBox: ComboBoxIndex): Locator {
    if (comboBox === ComboBoxIndex.labels) {
      return this.page
        .getByPlaceholder('Filter by labels')
        .or(this.page.getByRole('combobox', { name: 'Labels', exact: true }))
        .or(this.page.getByRole('combobox', { name: 'Filter by labels', exact: true }));
    }
    return this.page
      .getByPlaceholder('Filter by fields')
      .or(this.page.getByRole('combobox', { name: 'Filter by fields', exact: true }))
      .or(this.page.getByRole('combobox', { name: 'Fields', exact: true }));
  }

  /** Opens an index-scene ad hoc combobox; description tooltips (portal) can overlap sibling filters. */
  private async clickIndexAdHocCombobox(comboBox: ComboBoxIndex): Promise<void> {
    await this.page.keyboard.press('Escape');
    await this.getIndexAdHocCombobox(comboBox).first().click({ force: true });
  }

  async addNthValueToCombobox(
    labelName: string,
    operator: FilterOpType,
    comboBox: ComboBoxIndex,
    n: number,
    typeAhead?: string
  ) {
    await this.clickIndexAdHocCombobox(comboBox);

    if (typeAhead) {
      await this.page.keyboard.type(typeAhead);
    }

    // Select detected_level key
    await this.page.getByRole('option', { exact: true, name: labelName }).click();
    await expect(this.getOperatorLocator(operator)).toHaveCount(1);
    await expect(this.getOperatorLocator(operator)).toBeVisible();
    // Select operator
    await this.getOperatorLocator(operator).click();

    // assert the values have loaded
    await expect(this.page.getByRole('option', { name: /\[compactor-.+]/ }).nth(0)).toBeVisible();

    // Select the nth item
    for (let i = 0; i < n; i++) {
      await this.page.keyboard.press('ArrowDown');
    }
    // Select the item
    await this.page.keyboard.press('Enter');
    // Close the label name dropdown that opens after adding a value
    await this.page.keyboard.press('Escape');
  }

  /**
   *
   * @param labelName
   * @param operator
   * @param comboBox
   * @param text
   * @param typeAhead - if there are many options, the test can flake if the option isn't visible, if this string is passed in we'll type these chars to filter things down before attempting to click
   */
  async addCustomValueToCombobox(
    labelName: string,
    operator: FilterOpType,
    comboBox: ComboBoxIndex,
    text: string,
    typeAhead?: string,
    exact = false
  ) {
    await expect(this.getIndexAdHocCombobox(ComboBoxIndex.labels).first()).toBeVisible();
    await expect(this.getIndexAdHocCombobox(ComboBoxIndex.fields).first()).toBeVisible();

    await this.clickIndexAdHocCombobox(comboBox);
    if (typeAhead) {
      await this.page.keyboard.type(typeAhead);
      await this.assertNotLoading();
    }
    // Select detected_level key
    await this.page.getByRole('option', { name: labelName, exact }).click();
    await expect(this.getOperatorLocator(operator)).toHaveCount(1);
    await expect(this.getOperatorLocator(operator)).toBeVisible();
    // Select operator
    await this.getOperatorLocator(operator).click();
    // Assert operator is no longer visible
    await expect(this.getOperatorLocator(operator)).toHaveCount(0);
    // Enter custom value
    await this.page.keyboard.type(text);
    // Custom row is prepended by Combobox; use visible text (default "Use custom value" or i18n "Filter values by")
    const customValueRow = this.page
      .getByRole('option')
      .filter({ hasText: E2EComboboxStrings.customValueOptionHasText });
    await expect(customValueRow.first()).toBeVisible();
    await customValueRow.first().click();
    // Close the label name dropdown that opens after adding a value
    await this.page.keyboard.press('Escape');
  }

  getOperatorLocator(filter: FilterOpType): Locator {
    switch (filter) {
      case FilterOp.Equal:
        return this.page.getByRole('option', { exact: true, name: E2EComboboxStrings.operatorNames.equal });
      case FilterOp.NotEqual:
        return this.page.getByRole('option', { exact: true, name: E2EComboboxStrings.operatorNames.notEqual });
      case FilterOp.RegexEqual:
        return this.page.getByRole('option', { exact: true, name: E2EComboboxStrings.operatorNames.regexEqual });
      case FilterOp.RegexNotEqual:
        return this.page.getByRole('option', { exact: true, name: E2EComboboxStrings.operatorNames.regexNotEqual });
      default:
        throw new Error('invalid filter op');
    }
  }

  async assertPanelMenu() {
    const labelsPanelMenu = this.page.getByTestId(/data-testid Panel menu/);
    const panelMenuExploreItem = this.page.getByTestId('data-testid Panel menu item Explore');

    // Check menus for errors
    // Check first panel
    await labelsPanelMenu.nth(0).click();
    await expect(panelMenuExploreItem).toBeVisible();
    await labelsPanelMenu.nth(0).click();
    await expect(panelMenuExploreItem).not.toBeVisible();
  }

  /**
   * Asserts that label/field menus open and have link to explore
   * Since most of the integrations with other plugins are hooked into the viz panel menus,
   * this test asserts that fatal errors are not being triggered when the menu is rendered
   */
  async assertBreakdownPanelMenus() {
    await this.assertPanelMenu();

    const labelsPanelMenu = this.page.getByTestId(/data-testid Panel menu/);
    const panelMenuExploreItem = this.page.getByTestId('data-testid Panel menu item Explore');

    // Go to label value summary (stable vs plain-text "Select", which is duplicated / i18n-sensitive)
    await this.page.getByTestId(testIds.breakdowns.common.selectValueBreakdown).first().click();

    // Check first (summary) panel
    await labelsPanelMenu.nth(0).click();
    await expect(panelMenuExploreItem).toBeVisible();
    await labelsPanelMenu.nth(0).click();
    await expect(panelMenuExploreItem).not.toBeVisible();
  }

  async defaultColumnsAdminAddNewRecord() {
    await this.page.getByRole('button', { name: 'Add', exact: true }).click();
  }

  async defaultColumnsAddNewLabel() {
    await this.page.getByRole('button', { name: 'Add label' }).last().click();
  }

  async defaultColumnsAdminAddLabelName(labelName: string) {
    await this.page.getByTestId(testIds.appConfig.defaultColumns.labels.key).last().click();
    await this.page.keyboard.type(labelName);
    await this.page.getByRole('option', { name: labelName }).click();
  }

  async defaultColumnsAdminAddLabelValue(labelValue: string) {
    await this.page.getByTestId(testIds.appConfig.defaultColumns.labels.value).last().click();
    await this.page.keyboard.type(labelValue);
    await this.page.getByRole('option', { name: labelValue, exact: true }).click();
  }

  async defaultColumnsAdminAddColumn(columnName: string, columnText?: string | RegExp) {
    await this.page.getByRole('button', { name: 'Add column' }).last().click();
    await this.page.getByRole('combobox', { name: 'Select column' }).last().click();
    await this.page.getByRole('option', { name: columnName }).click();
    if (columnText) {
      await expect(this.page.getByText(columnText).first()).toBeVisible();
    }
  }

  async defaultColumnsDeleteAllRecords() {
    const deleteButtons = this.page.getByRole('button', { name: 'Delete record' });
    await this.assertNotLoading();
    const deleteButtonsCount = await deleteButtons.count();

    // Delete all existing records that may have persisted from other test executions
    for (let i = 0; i < deleteButtonsCount; i++) {
      await deleteButtons.nth(0).click();
      await expect(deleteButtons).toHaveCount(deleteButtonsCount - (i + 1));
    }

    const submitButton = this.page.getByRole('button', { name: /(Update|Create) default columns/ });
    const isDisabled = await submitButton.isDisabled();
    if (!isDisabled) {
      await submitButton.click();
    }
    await expect(deleteButtons).toHaveCount(0);
  }
}

export const E2EComboboxStrings = {
  /** Substring on the Combobox "create custom value" row (Grafana default vs FieldSelector i18n). */
  customValueOptionHasText: /Use custom value|Filter values by/i,
  editByKey: (keyName: string) => `Edit filter with key ${keyName}`,
  labels: {
    removeServiceLabel: 'Remove filter with key service_name',
  },
  operatorNames: {
    equal: '= Equals',
    notEqual: '!= Not equal',
    regexEqual: '=~ Matches regex',
    regexNotEqual: '!~ Does not match regex',
  },
  removeByKey: (keyName: string) => `Remove filter with key ${keyName}`,
};

export const levelTextMatch = /error|warn|info|debug/;

export enum ComboBoxIndex {
  labels,
  fields,
}

export const serviceSelectionPaginationTextMatch = /of \d+/;

export const E2ESubPath = '/grafana';
