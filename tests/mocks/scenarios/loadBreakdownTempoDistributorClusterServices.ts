import type { Page } from '@playwright/test';

import { dsQuery, labelsBreakdown } from '../labels/tempo-distributor-cluster-services';
import { buildDsQueryHandler } from './_util';

/**
 * Layer on top of `loadBreakdownTempoDistributor` to swap in a richer
 * `LABEL_BREAKDOWN_VALUES.service_name` response that includes multiple
 * services (nginx, mimir-ingester, tempo-ingester, tempo-distributor).
 *
 * Used by tests that drill `cluster=eu-west-1` then click "Select
 * service_name" and expect non-`tempo-distributor` panels:
 *   - `should replace service_name with cluster in url`
 *   - `combobox should replace service_name with regex cluster in url`
 */
export async function loadBreakdownTempoDistributorClusterServices(page: Page) {
  await page.route('**/ds/query*', buildDsQueryHandler({ dsQuery, labelsBreakdown }));
}
