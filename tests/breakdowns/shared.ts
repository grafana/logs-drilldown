import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

import type { LokiQuery } from '../../src/services/lokiQuery';
import { skipUnlessLatestGrafana } from '../config/grafana-versions-supported';
import { ExplorePage } from '../fixtures/explore';
import { getMockPatternsApiResponse } from '../mocks/getMockPatternsApiResponse';

export const fieldName = 'caller';

/**
 * Older @grafana/ui Select renders the selected label as the combobox input value;
 * newer Combobox renders it as visible text.  This helper accepts either representation.
 */
export async function expectComboboxLabel(container: Locator, expected: string) {
  await expect(async () => {
    const text = (await container.textContent()) ?? '';
    const value = await container.getByRole('combobox').inputValue();
    expect(text + value).toContain(expected);
  }).toPass();
}

export const levelName = 'detected_level';
export const metadataName = 'pod';
export const labelName = 'cluster';

/** Field breakdown panels use the detected field name as Loki query refId (see FieldsAggregatedBreakdownScene). */
export function getFieldBreakdownQuery(queries: LokiQuery[], field: string): LokiQuery | undefined {
  return queries.find((q) => q.refId === field);
}

/** Sparse empty-field filter rendered as `| bytes=""` (see ExpressionBuilder.test / renderLogQLFieldFilters). */
export function queriesContainBytesEqualEmptyFilter(queries: LokiQuery[]): boolean {
  return queries.some((q) => q.expr.includes('bytes=""'));
}

export async function setupServiceBreakdownTest(
  page: Page,
  grafanaVersion: string,
  testInfo: TestInfo
): Promise<ExplorePage> {
  skipUnlessLatestGrafana({ grafanaVersion });
  const explorePage = new ExplorePage(page, testInfo);

  await explorePage.setExtraTallViewportSize();
  await explorePage.clearLocalStorage();
  // Loki's pattern ingester is in-memory and never repopulates from the
  // static snapshot (`tests/static-loki/provisioning/loki/data.zip`), so the Patterns tab
  // would otherwise be empty for every test in this file. We register a
  // deterministic mock for the patterns datasource resource here; tests
  // that need a different patterns response override this route inside the test body.
  await page.route('**/resources/patterns**', async (route) => {
    await route.fulfill({ json: getMockPatternsApiResponse() });
  });
  await explorePage.gotoServicesBreakdownOldUrl();
  explorePage.blockAllQueriesExcept({
    legendFormats: [`{{${levelName}}}`],
    refIds: ['logsPanelQuery', fieldName],
  });
  explorePage.captureConsoleLogs();
  return explorePage;
}

export async function teardownServiceBreakdownTest(explorePage: ExplorePage | undefined): Promise<void> {
  if (!explorePage) {
    return;
  }
  await explorePage.unroute();
  explorePage.echoConsoleLogsOnRetry();
}
