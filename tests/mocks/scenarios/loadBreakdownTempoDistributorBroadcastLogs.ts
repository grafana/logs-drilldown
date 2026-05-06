import type { Page } from '@playwright/test';

import { dsQuery } from '../labels/tempo-distributor-broadcast-logs';
import { buildDsQueryHandler } from './_util';

/**
 * Layer on top of `loadBreakdownTempoDistributor` to swap in a
 * broadcast-only `logsPanelQuery` response. Used by:
 *   - `should filter logs panel on search for broadcast field`
 *
 * Only `logsPanelQuery` is registered here; `buildDsQueryHandler` falls back
 * to the previously registered `/ds/query` handler for any other refId so
 * the rest of the breakdown UI keeps working.
 */
export async function loadBreakdownTempoDistributorBroadcastLogs(page: Page) {
  await page.route('**/ds/query*', buildDsQueryHandler({ dsQuery }));
}
