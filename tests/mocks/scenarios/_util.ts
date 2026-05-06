/**
 * Pure parsing/iteration helpers used by scenarios. NO dispatching, NO
 * routing — these only know how to:
 *   - pull a path segment out of a URL (e.g. `<name>` from `/resources/label/<name>/values`)
 *   - pull the `by (X)` label out of a LogQL expression
 *   - iterate the queries in a `/ds/query` POST body and look each one up in a
 *     dataset the caller passes in
 *
 * Each scenario imports the data slices it needs and decides what to register.
 */
import type { Route } from '@playwright/test';

export type CapturedResponse = { frames?: unknown[]; status?: number };
export type DsQueryEntry = {
  refId: string;
  expr?: string;
  legendFormat?: string;
  response: CapturedResponse;
};
export type LabelsBreakdownFixture = Record<string, Record<string, CapturedResponse>>;

/**
 * Pull the path segment after `marker` from a URL — e.g.
 * `/.../resources/label/cluster/values?...` with `marker = 'label'` → `'cluster'`.
 */
export function extractPathSegment(url: string, marker: string): string | undefined {
  try {
    const parts = new URL(url).pathname.split('/');
    const idx = parts.indexOf(marker);
    return idx >= 0 ? parts[idx + 1] : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Pull the grouping label out of `... by (label)`. Returns `undefined` for
 * queries with no `by (...)` clause (logs queries, etc).
 */
export function extractByLabel(expr: string | undefined): string | undefined {
  if (!expr) {
    return undefined;
  }
  return expr.match(/\bby\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\)/)?.[1];
}

/**
 * Build a `/ds/query` route handler from a fixed set of data. Iterates the
 * `queries` in the POST body and looks each refId up in `labelsBreakdown` first
 * (label parsed from `by (X)`), then in the `dsQuery` array.
 *
 * If the request contains a refId the dataset doesn't know about, the handler
 * calls `route.fallback()` so the next-most-recently-registered handler can
 * try (which is how default routes serve `_global` queries that fire while a
 * per-service scenario is layered on top).
 *
 * `unknownRefIdBehavior: 'empty'` opts out of fallback and serves
 * `{ frames: [], status: 200 }` for unknown refIds — used by the default
 * scenario at the bottom of the route stack where there's nothing to fall
 * back to.
 */
export function buildDsQueryHandler(opts: {
  dsQuery?: DsQueryEntry[];
  labelsBreakdown?: LabelsBreakdownFixture;
  unknownRefIdBehavior?: 'fallback' | 'empty';
}) {
  const dsByRefId = new Map<string, CapturedResponse>();
  for (const entry of opts.dsQuery ?? []) {
    if (entry.refId && !dsByRefId.has(entry.refId)) {
      dsByRefId.set(entry.refId, entry.response);
    }
  }
  const labelsBreakdown = opts.labelsBreakdown ?? {};
  const fallbackOnUnknown = (opts.unknownRefIdBehavior ?? 'fallback') === 'fallback';

  return async (route: Route) => {
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
      if (fallbackOnUnknown) {
        return route.fallback();
      }
      results[refId] = { frames: [], status: 200 };
    }

    await route.fulfill({ json: { results } });
  };
}
