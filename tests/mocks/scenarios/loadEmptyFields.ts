import type { Page } from '@playwright/test';

/**
 * Layer that empties out `/resources/detected_fields` so the breakdown UI
 * shows the "We did not find any fields for the given time range" empty
 * state. Used by:
 *   - `should see empty fields UI` (nginx)
 */
export async function loadEmptyFields(page: Page) {
  await page.route('**/resources/detected_fields*', (route) => route.fulfill({ json: { fields: [], limit: 1000 } }));
}
