import type { Page } from '@playwright/test';

import { buildVolumeResponse } from '../labels/_global';
import type { VolumeEntry } from '../labels/_global';

/**
 * Scenario: user is on the namespace tab and has typed `Gate` in the search;
 * the follow-up `/index/volume` request should return only the `gateway`
 * namespace (Part 1 of the namespace tabs test asserts `of 1`).
 */
const gatewayOnly: VolumeEntry[] = [{ metric: { namespace: 'gateway' }, value: [1722536046.066, '5400000'] }];

export async function loadServiceSelectionFilterNamespaceGateway(page: Page) {
  await page.route('**/index/volume*', (route) => route.fulfill({ json: buildVolumeResponse(gatewayOnly) }));
}
