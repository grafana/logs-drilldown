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
 * `should filter logs by clicking on the chart levels` test.
 *
 * The test asserts:
 *   1. before clicking → `level=info` log lines visible
 *   2. user clicks `debug` chip → re-query with `detected_level=~"debug"`
 *   3. only `level=debug` log lines visible
 *
 * The captured `logsPanelQuery` frame has a mix of all four levels, so the
 * `/ds/query` handler here filters frame rows in-memory based on the
 * `detected_level=~"…"` clause in the request expr. Logic is inline (this
 * scenario owns it) rather than living in `_util.ts`.
 */
export async function loadBreakdownTempoDistributorWithLevelInfo(page: Page) {
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
        const levels = extractLevelFilter(query.expr);
        const frames = levels.length > 0 ? filterLogsByLevels(direct.frames ?? [], levels) : (direct.frames ?? []);
        results[refId] = { frames, status: direct.status ?? 200 };
        continue;
      }

      return route.fallback();
    }

    await route.fulfill({ json: { results } });
  });
}

/**
 * Pull every level out of `detected_level=~"a|b"`, `detected_level="a"`, or the
 * backtick form `detected_level=` + backtick + `a` + backtick (Loki Drilldown
 * uses backticks when adding filters from chart legend clicks).
 */
function extractLevelFilter(expr: string | undefined): string[] {
  if (!expr) {
    return [];
  }
  const levels: string[] = [];
  const regex = /detected_level\s*(?:=~|!~|=|!=)\s*["'`]([^"'`]+)["'`]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(expr)) !== null) {
    for (const part of match[1].split('|')) {
      const trimmed = part.trim();
      if (trimmed) {
        levels.push(trimmed);
      }
    }
  }
  return levels;
}

/**
 * Filter logs-panel frame rows by the `detected_level` field. Frame layout:
 *   - data.values[0]: labels (object) — has `detected_level`
 *   - data.values[1]: timestamps
 *   - data.values[2]: bodies
 *   - data.values[3]: ids
 *   - data.values[4]: labelTypes
 */
function filterLogsByLevels(frames: unknown[], levels: string[]): unknown[] {
  const allowed = new Set(levels);
  return frames.map((frame) => {
    const f = frame as { data?: { values?: unknown[][] } };
    if (!f.data?.values || f.data.values.length === 0) {
      return frame;
    }
    const labelsCol = f.data.values[0] as Array<Record<string, string> | undefined>;
    const keepIdx: number[] = [];
    labelsCol.forEach((lbl, idx) => {
      if (lbl && typeof lbl === 'object' && lbl.detected_level && allowed.has(lbl.detected_level)) {
        keepIdx.push(idx);
      }
    });
    return {
      ...f,
      data: {
        ...f.data,
        values: f.data.values.map((col) => keepIdx.map((idx) => (col as unknown[])[idx])),
      },
    };
  });
}
