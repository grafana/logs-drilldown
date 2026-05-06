import type { Page } from '@playwright/test';

import { buildVolumeResponse, volume } from '../labels/_global';

/**
 * Scenario: user has typed `tempo-d` in the service-selection search; the
 * follow-up `/index/volume` request should return only `tempo-distributor`.
 */
export async function loadServiceSelectionFilterTempoD(page: Page) {
  const filtered = volume.filter((entry) => entry.metric.service_name === 'tempo-distributor');
  await page.route('**/index/volume*', (route) => route.fulfill({ json: buildVolumeResponse(filtered) }));
}
