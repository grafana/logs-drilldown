import type { Page } from '@playwright/test';

import { buildVolumeResponse, volume } from '../labels/_global';

/**
 * Scenario: user has typed `imi` in the service-selection search; matches
 * every `mim-i-r-*` service via substring.
 */
export async function loadServiceSelectionFilterImi(page: Page) {
  const filtered = volume.filter((entry) => entry.metric.service_name.includes('imi'));
  await page.route('**/index/volume*', (route) => route.fulfill({ json: buildVolumeResponse(filtered) }));
}
