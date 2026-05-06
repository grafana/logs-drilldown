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
import { SNAPSHOT_TO_MS } from '../snapshotTime';
import { extractByLabel, extractPathSegment } from './_util';
import type { CapturedResponse, DsQueryEntry } from './_util';

/**
 * Variant of `loadBreakdownTempoDistributor` for the
 * `should show sample table on '<_>' click in patterns` test.
 *
 * Clicking `<_>` inside a pattern in the patterns table fires a /ds/query
 * with `refId: 'A'` whose expr contains `| pattern \`...\` | keep field_N`
 * (built by `PatternNameLabel.constructQuery`). The captured fixture only
 * has one `refId: 'A'` entry — the per-level count query — so the click
 * gets back stale frames and `convertResultToStats` produces no stats.
 *
 * `convertResultToStats` reads `result.data[0].fields[0].values.toArray()`
 * and expects each value to be a `{ field_N: 'X' }` object. We respond with
 * a synthetic frame whose first field carries those objects so the
 * Toggletip renders the "From a sample of N rows found" header.
 *
 * Same per-scenario static-mock pattern as
 * `loadBreakdownTempoDistributorBroadcastLogs`.
 */
export async function loadBreakdownTempoDistributorPatternSample(page: Page) {
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
      // Pattern-sample queries arrive as `refId: 'A'` and contain a `pattern`
      // pipeline stage that the captured per-level count query doesn't.
      if (refId === 'A' && query.expr?.includes('| pattern ')) {
        results[refId] = {
          frames: [buildPatternSampleFrame()],
          status: 200,
        };
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

/**
 * Synthetic Loki logs frame for pattern-sample queries.
 *
 * Loki returns logs frames with `fields[0]` = `labels` (type=other), whose
 * values are objects like `{ field_1: 'X' }` (only the kept fields after the
 * `| keep field_N` stage). Other fields (timestamp/body/etc.) carry empty
 * placeholder values to satisfy the frame contract.
 */
function buildPatternSampleFrame(): unknown {
  // Each pattern usually has multiple `<_>` placeholders; the click handler
  // surfaces stats for the clicked one. Populate field_1..field_3 so any
  // `<_>` index in the patterns table renders a stats row.
  const labelsValues = [
    { field_1: '2024-01-01T00:00:00Z', field_2: '0.123', field_3: 'tempo-distributor-163tj' },
    { field_1: '2024-01-01T00:00:01Z', field_2: '0.456', field_3: 'tempo-distributor-163tj' },
    { field_1: '2024-01-01T00:00:02Z', field_2: '0.789', field_3: 'tempo-distributor-2kb19' },
    { field_1: '2024-01-01T00:00:03Z', field_2: '0.234', field_3: 'tempo-distributor-2kb19' },
    { field_1: '2024-01-01T00:00:04Z', field_2: '0.567', field_3: 'tempo-distributor-30v4m' },
  ];
  const length = labelsValues.length;
  return {
    schema: {
      refId: 'A',
      meta: { type: 'log-lines', custom: { frameType: 'LabeledTimeValues' } },
      fields: [
        { name: 'labels', type: 'other' },
        { name: 'timestamp', type: 'time' },
        { name: 'body', type: 'string' },
        { name: 'id', type: 'string' },
      ],
    },
    data: {
      values: [
        labelsValues,
        // Anchor timestamps to the fixed snapshot end so the frame sits
        // inside the test's deterministic window. Rows step back 1s each
        // so they remain ordered.
        Array.from({ length }, (_, i) => SNAPSHOT_TO_MS - (length - i) * 1000),
        Array.from({ length }, () => ''),
        Array.from({ length }, (_, i) => `pattern-sample-${i}`),
      ],
    },
  };
}
