import type { Page, Route } from '@playwright/test';

import {
  detectedFields,
  detectedLabels,
  dsQuery,
  fieldValues,
  labelsBreakdown,
  labelValues,
  patterns,
} from '../labels/service_name-nginx-json';
import { extractByLabel, extractPathSegment } from './_util';
import type { CapturedResponse, DsQueryEntry } from './_util';

/**
 * Variant of `loadBreakdownNginxJson` for the `should see clear fields UI`
 * test, which deep-links to nginx-json's fields tab with a sparse-empty filter
 * (`var-fields=bytes|=|""`). With real Loki, the `| bytes=""` pipeline yields
 * no streams, so `FieldsBreakdownScene.updateOptions` flips to
 * `NoMatchingLabelsScene` ("No fields match these filters.").
 *
 * We replicate that here by checking the request frame URL (or the LogQL
 * `query` param) for `bytes|=|""` / `| bytes=""` and returning empty
 * `detectedFields` while the filter is present. Same per-scenario dynamic-mock
 * pattern as `loadBreakdownTempoDistributorWithLevelInfo`.
 */
export async function loadBreakdownNginxJsonBytesEmpty(page: Page) {
  await page.route('**/resources/detected_fields*', (route) => {
    if (hasBytesEmptyFilter(route.request().frame().url(), getQueryParam(route.request().url(), 'query'))) {
      return route.fulfill({ json: { fields: [] } });
    }
    return route.fulfill({ json: detectedFields });
  });
  await page.route('**/resources/detected_labels*', (route) => route.fulfill({ json: detectedLabels }));
  await page.route('**/resources/patterns*', (route) => route.fulfill({ json: patterns }));
  await page.route('**/resources/label/*/values*', (route) => {
    const name = extractPathSegment(route.request().url(), 'label');
    return route.fulfill({ json: { status: 'success', data: name ? (labelValues[name] ?? []) : [] } });
  });
  await page.route('**/resources/detected_field/*/values*', (route) => {
    const name = extractPathSegment(route.request().url(), 'detected_field');
    return route.fulfill({ json: { values: name ? (fieldValues[name] ?? []) : [] } });
  });

  const dsByRefId = new Map<string, CapturedResponse>();
  for (const entry of dsQuery as DsQueryEntry[]) {
    if (entry.refId && !dsByRefId.has(entry.refId)) {
      dsByRefId.set(entry.refId, entry.response);
    }
  }

  await page.route('**/ds/query*', async (route: Route) => {
    const post = route.request().postDataJSON() as { queries?: Array<{ refId?: string; expr?: string }> } | undefined;
    const queries = post?.queries ?? [];
    const results: Record<string, { frames: unknown[]; status: number }> = {};

    for (const query of queries) {
      const refId = query.refId;
      if (!refId) {
        continue;
      }
      const breakdownByLabel = labelsBreakdown[refId];
      if (breakdownByLabel) {
        const label = extractByLabel(query.expr);
        const hit = (label && breakdownByLabel[label]) ?? Object.values(breakdownByLabel)[0];
        results[refId] = { frames: hit?.frames ?? [], status: hit?.status ?? 200 };
        continue;
      }

      const direct = dsByRefId.get(refId);
      if (direct) {
        results[refId] = { frames: direct.frames ?? [], status: direct.status ?? 200 };
        continue;
      }

      return route.fallback();
    }

    await route.fulfill({ json: { results } });
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
      // var-fields chip format: `<key>|<op>|<value>` with the value possibly
      // wrapped in quotes (e.g. `bytes|=|""`).
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
