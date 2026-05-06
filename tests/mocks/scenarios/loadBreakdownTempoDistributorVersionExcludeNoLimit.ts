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
 * Variant of `loadBreakdownTempoDistributor` for the
 * `should not see maximum of series limit reached after changing filters` test.
 *
 * The captured `content` frame carries a Loki notice
 * (`schema.meta.notices = [{ severity: 'warning', text: 'maximum number of
 * series (500) reached…' }]`) which Grafana renders as the panel-status icon
 * — exactly what the test asserts should disappear after the user excludes
 * the `version` filter. With real Loki, the new query carries
 * `version!="…"`, returns fewer series, and the notice is gone.
 *
 * We replicate that here by stripping `notices` from the content frame's
 * `schema.meta` whenever the request expr contains a `version!=` clause.
 * Same per-scenario dynamic-mock pattern as
 * `loadBreakdownTempoDistributorWithLevelInfo`.
 */
export async function loadBreakdownTempoDistributorVersionExcludeNoLimit(page: Page) {
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
      const breakdownByLabel = labelsBreakdown[refId];
      if (breakdownByLabel) {
        const label = extractByLabel(query.expr);
        const hit = (label && breakdownByLabel[label]) ?? Object.values(breakdownByLabel)[0];
        results[refId] = { frames: hit?.frames ?? [], status: hit?.status ?? 200 };
        continue;
      }

      const direct = dsByRefId.get(refId);
      if (direct) {
        const frames = direct.frames ?? [];
        // The `content` panel is the only one with a series-limit warning in
        // the captured fixture; clear it once the user excludes `version`.
        const cleaned = refId === 'content' && hasVersionExclude(query.expr) ? stripNotices(frames) : frames;
        results[refId] = { frames: cleaned, status: direct.status ?? 200 };
        continue;
      }

      return route.fallback();
    }

    await route.fulfill({ json: { results } });
  });
}

function hasVersionExclude(expr: string | undefined): boolean {
  if (!expr) {
    return false;
  }
  return /\bversion\s*(!=|!~)\s*["'`]/.test(expr);
}

function stripNotices(frames: unknown[]): unknown[] {
  return frames.map((frame) => {
    const f = frame as { schema?: { meta?: Record<string, unknown> } };
    if (!f.schema?.meta?.notices) {
      return frame;
    }
    const { notices: _omit, ...metaWithoutNotices } = f.schema.meta;
    return {
      ...f,
      schema: { ...f.schema, meta: metaWithoutNotices },
    };
  });
}
