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
 * `int fields should allow avg_over_time queries` test.
 *
 * The test inspects the captured response's
 * `frames[0].schema.meta.executedQueryString` and asserts it contains
 * `avg_over_time({service_name="tempo-distributor"}` once the user clicks
 * "Plot average". The captured fixture has a `count_over_time` expr baked in,
 * so we echo back whatever expr the request actually sent — that's the only
 * piece of dynamism this scenario needs.
 *
 * Same per-scenario dynamic-mock pattern as
 * `loadBreakdownTempoDistributorWithLevelInfo`.
 */
export async function loadBreakdownTempoDistributorEchoExecutedQuery(page: Page) {
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
    const post = route.request().postDataJSON() as
      | { queries?: Array<{ refId?: string; expr?: string; step?: string }> }
      | undefined;
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
        results[refId] = {
          frames: echoExecutedQuery(hit?.frames ?? [], query.expr, query.step),
          status: hit?.status ?? 200,
        };
        continue;
      }

      const direct = dsByRefId.get(refId);
      if (direct) {
        results[refId] = {
          frames: echoExecutedQuery(direct.frames ?? [], query.expr, query.step),
          status: direct.status ?? 200,
        };
        continue;
      }

      return route.fallback();
    }

    await route.fulfill({ json: { results } });
  });
}

/**
 * Replace `frames[0].schema.meta.executedQueryString` with a string that
 * echoes the request's expr (and step, if present), matching what real Loki
 * returns. Other frames are passed through unchanged.
 */
function echoExecutedQuery(frames: unknown[], expr: string | undefined, step: string | undefined): unknown[] {
  if (frames.length === 0 || !expr) {
    return frames;
  }
  const [first, ...rest] = frames as Array<{ schema?: { meta?: Record<string, unknown> } }>;
  if (!first?.schema?.meta) {
    return frames;
  }
  const stepLine = step ? `\nStep: ${step}` : '';
  const executedQueryString = `Expr: ${expr}${stepLine}`;
  return [
    {
      ...first,
      schema: {
        ...first.schema,
        meta: { ...first.schema.meta, executedQueryString },
      },
    },
    ...rest,
  ];
}
