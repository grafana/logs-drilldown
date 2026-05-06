import type { Page } from '@playwright/test';

import {
  detectedFields,
  detectedLabels,
  dsQuery,
  fieldValues,
  labelsBreakdown,
  labelValues,
  patterns,
} from '../labels/namespace-mimir';
import { buildDsQueryHandler, extractPathSegment } from './_util';

/**
 * Scenario: user has switched the namespace combobox value from `gateway` to
 * `mimir`. Used by Part 2 of the `tabs - namespace` block to assert tab counts
 * change when the primary label value flips.
 */
export async function loadBreakdownNamespaceMimir(page: Page) {
  await page.route('**/resources/detected_fields*', (route) => route.fulfill({ json: detectedFields }));
  await page.route('**/resources/detected_labels*', (route) => route.fulfill({ json: detectedLabels }));
  await page.route('**/resources/patterns*', (route) => route.fulfill({ json: patterns }));
  await page.route('**/resources/label/*/values*', (route) => {
    const name = extractPathSegment(route.request().url(), 'label');
    return route.fulfill({ json: { status: 'success', data: name ? (labelValues[name] ?? []) : [] } });
  });
  await page.route('**/resources/detected_field/*/values*', (route) => {
    const name = extractPathSegment(route.request().url(), 'detected_field');
    return route.fulfill({ json: { values: name ? (fieldValues[name] ?? []) : [] } });
  });
  await page.route('**/ds/query*', buildDsQueryHandler({ dsQuery, labelsBreakdown }));
}
