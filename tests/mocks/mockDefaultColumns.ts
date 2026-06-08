import { Page } from '@playwright/test';

import {
  getMockDefaultColumnsDetectedFieldsApiResponse,
  getMockDefaultColumnsLabelsListApiResponse,
} from './getMockDefaultColumnsLabelsApiResponse';

/** Loki-style JSON for `…/resources/label/<name>/values` (static list for e2e). */
export const mockDefaultColumnsValuesEndpointResponse = {
  status: 'success' as const,
  data: [
    'apache',
    'dev',
    'eu-east-1',
    'eu-west-1',
    'gateway',
    'infra',
    'mimir',
    'monitoring',
    'nginx',
    'prod',
    'staging',
    'tempo-distributor',
    'us-east-1',
    'us-east-2',
    'us-west-1',
    'us-west-2',
  ],
};

/**
 * Playwright routes for Loki metadata on the admin **Default fields** page.
 * Same style as tests/breakdowns/shared.ts: string glob patterns and route.fulfill with a JSON body.
 */
export async function mockDefaultColumns(page: Page): Promise<void> {
  await page.route('**/resources/detected_fields**', async (route) => {
    await route.fulfill({ json: getMockDefaultColumnsDetectedFieldsApiResponse() });
  });

  await page.route('**/api/v1/label/**', async (route) => {
    if (!route.request().url().includes('/values')) {
      return route.continue();
    }
    await route.fulfill({ json: mockDefaultColumnsValuesEndpointResponse });
  });

  await page.route('**/resources/labels**', async (route) => {
    await route.fulfill({ json: getMockDefaultColumnsLabelsListApiResponse() });
  });

  await page.route('**/resources/label/**/values**', async (route) => {
    await route.fulfill({ json: mockDefaultColumnsValuesEndpointResponse });
  });
}
