import type { Page, Route } from '@playwright/test';

import { dsQuery } from '../labels/service_name-tempo-distributor';
import { SNAPSHOT_TO_MS } from '../snapshotTime';
import type { DsQueryEntry } from './_util';

const CONTEXT_ROW_COUNT = 10;

/**
 * Variant of `loadBreakdownTempoDistributor` for the
 * `should open logs context` test.
 *
 * "Show context" on a log row fires a separate /ds/query with a dynamic
 * `refId: 'log-row-context-query<…>'`. The captured fixture has no entry for
 * that refId, so `buildDsQueryHandler`'s `unknownRefIdBehavior: 'empty'`
 * returns no frames and the context dialog renders an empty result —
 * `dialog.getByTitle('See log details')` is empty and the test fails.
 *
 * This scenario detects context refIds and replies with a slice of the
 * captured logs frames, with timestamps anchored to the fixed snapshot
 * window (`tests/mocks/snapshotTime.ts`) so the rows fall inside the
 * test's deterministic time range.
 */
export async function loadBreakdownTempoDistributorLogsContext(page: Page) {
  const logsEntry = (dsQuery as DsQueryEntry[]).find((e) => e.refId === 'logsPanelQuery');
  if (!logsEntry) {
    return;
  }
  const baseFrame = logsEntry.response.frames?.[0] as
    | {
        schema?: unknown;
        data?: { values?: unknown[][] };
      }
    | undefined;
  if (!baseFrame || !baseFrame.data?.values) {
    return;
  }

  await page.route('**/ds/query*', async (route: Route) => {
    const post = route.request().postDataJSON() as { queries?: Array<{ refId?: string }> } | undefined;
    const queries = post?.queries ?? [];
    const contextRefIds = queries
      .map((q) => q.refId)
      .filter((id): id is string => Boolean(id && /^log-row-context-query/.test(id)));
    if (contextRefIds.length === 0) {
      return route.fallback();
    }

    const results: Record<string, { frames: unknown[]; status: number }> = {};
    for (const refId of contextRefIds) {
      results[refId] = {
        frames: [buildContextFrame(baseFrame, refId)],
        status: 200,
      };
    }

    await route.fulfill({ json: { results } });
  });
}

function buildContextFrame(template: { schema?: unknown; data?: { values?: unknown[][] } }, refId: string): unknown {
  const values = template.data?.values ?? [];
  const sliced = values.map((column) => (Array.isArray(column) ? column.slice(0, CONTEXT_ROW_COUNT) : column));
  // Field index 1 is the `timestamp` (ms epoch) column on the captured logs
  // frame; anchor it to the snapshot end so the rows appear in-range for
  // the dialog. Rows step back 1s each so they remain ordered.
  if (Array.isArray(sliced[1])) {
    sliced[1] = sliced[1].map((_, i) => SNAPSHOT_TO_MS - (CONTEXT_ROW_COUNT - i) * 1000);
  }
  // Rewrite the `id` column (index 3) so each row is unique within the
  // returned context frame.
  if (Array.isArray(sliced[3])) {
    sliced[3] = sliced[3].map((_, i) => `${refId}-row-${i}`);
  }
  return {
    schema: { ...(template.schema as object), refId },
    data: { values: sliced },
  };
}
