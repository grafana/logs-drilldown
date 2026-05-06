import type { Page } from '@playwright/test';

import { volumeResponse } from '../labels/_global';

/**
 * Reset the `/index/volume` handler back to the full canonical service list.
 * Useful after a test has loaded a filter scenario (e.g.
 * `loadServiceSelectionFilterNginxExact`) and then clears the search to expect
 * the unfiltered list again.
 */
export async function loadServiceSelectionDefault(page: Page) {
  await page.route('**/index/volume*', (route) => route.fulfill({ json: volumeResponse }));
}
