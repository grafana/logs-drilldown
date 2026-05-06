import type { Page } from '@playwright/test';

import { buildVolumeResponse, volume } from '../labels/_global';

/**
 * Scenario: user has typed `mimir-i` in the service-selection search; the
 * follow-up `/index/volume` request should return only `mimir-ingester`.
 */
export async function loadServiceSelectionFilterMimirI(page: Page) {
  const filtered = volume.filter((entry) => entry.metric.service_name === 'mimir-ingester');
  await page.route('**/index/volume*', (route) => route.fulfill({ json: buildVolumeResponse(filtered) }));
}
