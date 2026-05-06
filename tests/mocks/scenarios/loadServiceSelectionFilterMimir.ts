import type { Page } from '@playwright/test';

import { buildVolumeResponse, volume } from '../labels/_global';

/**
 * Scenario: user has typed `mimir` in the service-selection search and the
 * follow-up `/index/volume` request should return every `mimir-*` service.
 */
export async function loadServiceSelectionFilterMimir(page: Page) {
  const filtered = volume.filter((entry) => entry.metric.service_name.includes('mimir'));
  await page.route('**/index/volume*', (route) => route.fulfill({ json: buildVolumeResponse(filtered) }));
}
