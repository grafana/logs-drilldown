import type { Page } from '@playwright/test';

import { detectedFields } from '../labels/service_name-tempo-distributor';

/**
 * Variant of `loadBreakdownTempoDistributor` for the
 * `should exclude all logs that contain bytes field` test.
 *
 * The test clicks Exclude on the bytes panel which adds a `bytes=""` chip.
 * With real Loki the resulting `| bytes=""` pipeline yields no streams that
 * carry the bytes label, so `/resources/detected_fields` returns no `bytes`
 * entry and the `FieldsAggregatedBreakdownScene` removes the bytes panel.
 *
 * We replicate that here by stripping `bytes` from the
 * `/resources/detected_fields` response when the request URL carries a
 * `bytes=""` filter (in either the LogQL `query` param or the page-state
 * `var-fields` chip). Same per-scenario dynamic-mock pattern as
 * `loadBreakdownNginxJsonBytesEmpty`.
 */
export async function loadBreakdownTempoDistributorBytesEmpty(page: Page) {
  await page.route('**/resources/detected_fields*', (route) => {
    if (hasBytesEmptyFilter(route.request().frame().url(), getQueryParam(route.request().url(), 'query'))) {
      return route.fulfill({
        json: { ...detectedFields, fields: detectedFields.fields.filter((f) => f.label !== 'bytes') },
      });
    }
    return route.fulfill({ json: detectedFields });
  });
}

function getQueryParam(url: string, name: string): string | undefined {
  try {
    return new URL(url).searchParams.get(name) ?? undefined;
  } catch {
    return undefined;
  }
}

function hasBytesEmptyFilter(pageUrl: string, logqlQuery: string | undefined): boolean {
  if (logqlQuery && /\|\s*bytes\s*=\s*"\s*"/.test(logqlQuery)) {
    return true;
  }
  try {
    const params = new URL(pageUrl).searchParams.getAll('var-fields');
    for (const raw of params) {
      const parts = raw.split('|');
      if (parts.length >= 3 && parts[0] === 'bytes' && parts[1] === '=' && /^"?\s*"?$/.test(parts[2])) {
        return true;
      }
    }
  } catch {
    // ignore malformed URLs
  }
  return false;
}
