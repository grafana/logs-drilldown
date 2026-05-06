import type { Page, Route } from '@playwright/test';

import {
  detectedFields,
  detectedLabels,
  dsQuery,
  fieldValues,
  labelsBreakdown,
  labelValues,
  patterns,
} from '../labels/service_name-tempo-distributor';
import { extractByLabel, extractPathSegment } from './_util';
import type { CapturedResponse, DsQueryEntry } from './_util';

/**
 * Variant of `loadBreakdownTempoDistributor` for the two parser-update tests:
 *   - `field value breakdown: changing parser updates query`
 *   - `label value breakdown: changing parser updates query`
 *
 * Both tests open a value breakdown (caller field / detected_level label),
 * then add a logfmt-parser field filter (`content="…"`). With real Loki, the
 * extra `content` predicate drops most series and the breakdown ends up
 * showing exactly two panels.
 *
 * We honor that here by truncating the relevant frames to a single sub-panel
 * frame when a `content=…` clause is present in the request expr — the
 * breakdown view also renders one fixed `ValueSummaryPanelScene` panel above
 * the sub-panels, so 1 frame → 2 panels in the DOM. Same per-scenario
 * dynamic-mock pattern as `loadBreakdownTempoDistributorWithLevelInfo`.
 */
export async function loadBreakdownTempoDistributorContentFilteredTwo(page: Page) {
  await page.route('**/resources/detected_fields*', (route) => route.fulfill({ json: detectedFields }));
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
      const contentFiltered = hasContentFilter(query.expr);

      const breakdownByLabel = labelsBreakdown[refId];
      if (breakdownByLabel) {
        const label = extractByLabel(query.expr);
        const hit = (label && breakdownByLabel[label]) ?? Object.values(breakdownByLabel)[0];
        const frames = hit?.frames ?? [];
        results[refId] = {
          frames: contentFiltered ? frames.slice(0, 1) : frames,
          status: hit?.status ?? 200,
        };
        continue;
      }

      const direct = dsByRefId.get(refId);
      if (direct) {
        const frames = direct.frames ?? [];
        results[refId] = {
          frames: contentFiltered ? frames.slice(0, 1) : frames,
          status: direct.status ?? 200,
        };
        continue;
      }

      return route.fallback();
    }

    await route.fulfill({ json: { results } });
  });
}

function hasContentFilter(expr: string | undefined): boolean {
  if (!expr) {
    return false;
  }
  // Field-filter chips render as `| content="value"` (logfmt parser injected).
  return /\|\s*content\s*=\s*["'`]/.test(expr) || /\bcontent\s*=\s*["'`][^"'`]+["'`]/.test(expr);
}
