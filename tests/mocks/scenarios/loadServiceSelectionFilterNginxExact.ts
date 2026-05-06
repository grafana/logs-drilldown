import type { Page } from '@playwright/test';

import { buildVolumeResponse, volume } from '../labels/_global';

/**
 * Scenario: user has typed `^nginx$` in the service-selection search and the
 * follow-up `/index/volume` request should return only the `nginx` service.
 *
 * Volume is the only endpoint that needs overriding here — detected fields,
 * detected labels and `/ds/query` still come from the default scenario
 * (tempo-ingester) until the user actually drills into a service.
 */
export async function loadServiceSelectionFilterNginxExact(page: Page) {
  const filtered = volume.filter((entry) => entry.metric.service_name === 'nginx');
  await page.route('**/index/volume*', (route) => route.fulfill({ json: buildVolumeResponse(filtered) }));
}
