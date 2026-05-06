import type { Page } from '@playwright/test';

import { dsQuery, labelsBreakdownUsClustersOnly } from '../labels/tempo-distributor-cluster-services';
import { buildDsQueryHandler } from './_util';

/**
 * Layer scoping the `cluster` breakdown to `us-*` clusters only. Used by the
 * `combobox should replace service_name with regex cluster in url` test,
 * which adds a `cluster=~us-.+` regex filter and expects 3 `us-*` panels +
 * the summary panel.
 */
export async function loadBreakdownTempoDistributorClusterUsOnly(page: Page) {
  await page.route('**/ds/query*', buildDsQueryHandler({ dsQuery, labelsBreakdown: labelsBreakdownUsClustersOnly }));
}
