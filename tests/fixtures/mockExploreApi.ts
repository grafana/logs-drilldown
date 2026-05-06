import { Page } from '@playwright/test';

import {
  defaultLabels,
  drilldownLimits,
  dsQuery as globalDsQuery,
  labelsList,
  series,
  volumeResponse,
} from '../mocks/labels/_global';
import {
  detectedFields as tempoIngesterDetectedFields,
  detectedLabels as tempoIngesterDetectedLabels,
  dsQuery as tempoIngesterDsQuery,
  fieldValues as tempoIngesterFieldValues,
  labelsBreakdown as tempoIngesterLabelsBreakdown,
  labelValues as tempoIngesterLabelValues,
  patterns as tempoIngesterPatterns,
} from '../mocks/labels/service_name-tempo-ingester';
import { buildDsQueryHandler, extractPathSegment } from '../mocks/scenarios/_util';

/**
 * Register the default scenario on the page:
 *   - `_global` static endpoints (`volume`, `labels`, `series`, `drilldown-limits`,
 *     `default-labels`).
 *   - The `tempo-ingester` service is wired in by default so a test that just
 *     navigates to a breakdown gets data without calling any scenario loader.
 *   - `/ds/query` is served by an inline handler that knows about both
 *     `_global` and `tempo-ingester` refIds (returns empty frames for unknowns).
 *
 * Tests layer on extra scenarios (e.g. `loadBreakdownNginx(page)`) by calling
 * `page.route(...)` again — Playwright runs handlers most-recently-registered
 * first, so the new ones shadow the defaults; `route.fallback()` from a layered
 * handler defers back to these defaults.
 */
export async function mockExploreApi(page: Page) {
  await page.route('**/index/volume*', (route) => route.fulfill({ json: volumeResponse }));
  await page.route('**/resources/labels*', (route) => route.fulfill({ json: labelsList }));
  await page.route('**/resources/series*', (route) => route.fulfill({ json: series }));
  await page.route('**/resources/drilldown-limits*', (route) => route.fulfill({ json: drilldownLimits }));
  await page.route('**/logsdrilldowndefaultlabels*', (route) => route.fulfill({ json: defaultLabels }));

  await page.route('**/resources/detected_fields*', (route) => route.fulfill({ json: tempoIngesterDetectedFields }));
  await page.route('**/resources/detected_labels*', (route) => route.fulfill({ json: tempoIngesterDetectedLabels }));
  await page.route('**/resources/patterns*', (route) => route.fulfill({ json: tempoIngesterPatterns }));
  await page.route('**/resources/label/*/values*', (route) => {
    const name = extractPathSegment(route.request().url(), 'label');
    return route.fulfill({
      json: { status: 'success', data: name ? (tempoIngesterLabelValues[name] ?? []) : [] },
    });
  });
  await page.route('**/resources/detected_field/*/values*', (route) => {
    const name = extractPathSegment(route.request().url(), 'detected_field');
    return route.fulfill({
      json: { values: name ? (tempoIngesterFieldValues[name] ?? []) : [] },
    });
  });

  await page.route(
    '**/ds/query*',
    buildDsQueryHandler({
      // tempo-ingester refIds win over global for the ones they share (logsPanelQuery, etc.).
      dsQuery: [...tempoIngesterDsQuery, ...globalDsQuery],
      labelsBreakdown: tempoIngesterLabelsBreakdown,
      unknownRefIdBehavior: 'empty',
    })
  );
}
