import type { Page } from '@playwright/test';

import { buildVolumeResponse } from '../labels/_global';
import type { VolumeEntry } from '../labels/_global';

/**
 * Scenario: user has added `namespace` as a primary-label tab. The
 * `/index/volume` request now groups by `namespace` instead of `service_name`,
 * so the response shape uses `metric.namespace` instead of `metric.service_name`.
 *
 * Six namespaces match the `Part 1` test assertion `of 6`.
 */
const namespaceVolume: VolumeEntry[] = [
  { metric: { namespace: 'gateway' }, value: [1722536046.066, '5400000'] },
  { metric: { namespace: 'mimir' }, value: [1722536046.066, '4200000'] },
  { metric: { namespace: 'tempo' }, value: [1722536046.066, '3100000'] },
  { metric: { namespace: 'loki' }, value: [1722536046.066, '2400000'] },
  { metric: { namespace: 'grafana' }, value: [1722536046.066, '1700000'] },
  { metric: { namespace: 'monitoring' }, value: [1722536046.066, '900000'] },
];

export async function loadServiceSelectionNamespaceTab(page: Page) {
  await page.route('**/index/volume*', (route) => route.fulfill({ json: buildVolumeResponse(namespaceVolume) }));
}
