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
 * `Fields: can regex include caller values containing "st"` test.
 *
 * The test applies a `caller=~".+st.+"` filter and then navigates back to the
 * Fields tab, where the `caller` field-summary panel must shrink its legend
 * from 8 → 3 series. With real Loki, the response would only include caller
 * values that match the regex; we replicate that here by filtering the
 * captured `caller` frames against whatever regex the request expr carries.
 *
 * Same per-scenario dynamic-mock pattern as
 * `loadBreakdownTempoDistributorWithLevelInfo`.
 */
export async function loadBreakdownTempoDistributorCallerRegexFilter(page: Page) {
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
        const callerRegex = refId === 'caller' ? extractFieldRegex(query.expr, 'caller') : undefined;
        results[refId] = {
          frames: callerRegex ? filterFramesByLabel(frames, 'caller', callerRegex) : frames,
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
 * Pull the regex value from a `<key>=~"…"` clause in a LogQL expr (handles
 * single quotes / backticks). Returns the first occurrence as a `RegExp`, or
 * `undefined` if the field isn't being regex-filtered.
 */
function extractFieldRegex(expr: string | undefined, key: string): RegExp | undefined {
  if (!expr) {
    return undefined;
  }
  const pattern = new RegExp(`\\b${key}\\s*=~\\s*["'\`]([^"'\`]+)["'\`]`);
  const match = expr.match(pattern);
  if (!match) {
    return undefined;
  }
  try {
    return new RegExp(`^(?:${match[1]})$`);
  } catch {
    return undefined;
  }
}

/**
 * Drop frames whose `schema.fields[1].labels[label]` doesn't match `regex`.
 * Frames without that label fall through unchanged so summary/total frames
 * (Loki sometimes prepends them) are preserved.
 */
function filterFramesByLabel(frames: unknown[], label: string, regex: RegExp): unknown[] {
  return frames.filter((frame) => {
    const f = frame as { schema?: { fields?: Array<{ labels?: Record<string, string> }> } };
    const value = f.schema?.fields?.[1]?.labels?.[label];
    if (value == null) {
      return true;
    }
    return regex.test(value);
  });
}
