import type { Page } from '@playwright/test';

import {
  detectedFields,
  detectedLabels,
  dsQuery,
  fieldValues,
  labelsBreakdown,
  labelValues,
  patterns,
} from '../labels/service_name-nginx-json-mixed';
import { buildDsQueryHandler, extractPathSegment } from './_util';

/**
 * Scenario: user has drilled into `{service_name="nginx-json-mixed"}`. Layers
 * mixed-parser nginx-json data over the default `tempo-ingester` per-service
 * routes.
 */
export async function loadBreakdownNginxJsonMixed(page: Page) {
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
