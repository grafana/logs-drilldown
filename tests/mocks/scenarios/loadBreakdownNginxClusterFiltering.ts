import type { Page, Route } from '@playwright/test';

import {
  detectedFields,
  detectedLabels,
  dsQuery,
  fieldValues,
  labelsBreakdown,
  labelValues,
  patterns,
} from '../labels/service_name-nginx';
import { extractByLabel, extractPathSegment } from './_util';
import type { CapturedResponse, DsQueryEntry } from './_util';

/**
 * Variant of `loadBreakdownNginx` for the `should see empty labels UI` test.
 *
 * The test drills into the `cluster` label and clicks the exclude button on
 * every cluster panel. The "No labels match these filters." UI flips on when
 * `LabelBreakdownScene.setEmptyStates` sees an empty
 * `/resources/detected_labels` frame — so this scenario watches for
 * `cluster!="…"` clauses (in the LogQL `query` param OR the page URL filter
 * chips) and returns `{ detectedLabels: [] }` once every nginx cluster has
 * been excluded. Same per-scenario dynamic-mock pattern as
 * `loadBreakdownTempoDistributorWithLevelInfo`.
 */
export async function loadBreakdownNginxClusterFiltering(page: Page) {
  await page.route('**/resources/detected_fields*', (route) => route.fulfill({ json: detectedFields }));
  await page.route('**/resources/detected_labels*', (route) => {
    // The Drilldown UI re-queries detected_labels whenever stream selectors
    // change. When every nginx cluster has a `cluster!=` filter, real Loki
    // would return no streams; honor that here so the breakdown's
    // setEmptyStates flips to NoMatchingLabelsScene → "No labels match these
    // filters." The 4 cluster values come from the labelsBreakdown frames.
    const reqUrl = route.request().url();
    const excludedFromQuery = extractClusterExcludesFromLogQL(getQueryParam(reqUrl, 'query'));
    const excludedFromPage = extractClusterExcludesFromPageUrl(route.request().frame().url());
    const excluded = new Set<string>([...excludedFromQuery, ...excludedFromPage]);
    const allClusters = ['eu-west-1', 'us-east-1', 'us-east-2', 'us-west-1'];
    const allExcluded = allClusters.every((c) => excluded.has(c));
    if (allExcluded) {
      return route.fulfill({ json: { detectedLabels: [] } });
    }
    return route.fulfill({ json: detectedLabels });
  });
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
    // The breakdown re-fires LABEL_BREAKDOWN_VALUES less aggressively than the
    // resource APIs, so we still serve the cluster legend from the captured
    // labelsBreakdown frames here. The `NoMatchingLabelsScene` path is driven
    // by `/resources/detected_labels` returning `{ detectedLabels: [] }` once
    // every cluster has been excluded (handled above).
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

function extractClusterExcludesFromLogQL(expr: string | undefined): Set<string> {
  const out = new Set<string>();
  if (!expr) {
    return out;
  }
  const regex = /cluster\s*(!=|!~)\s*["'`]([^"'`]+)["'`]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(expr)) !== null) {
    for (const part of match[2].split('|')) {
      const trimmed = part.trim();
      if (trimmed) {
        out.add(trimmed);
      }
    }
  }
  return out;
}

/**
 * Pull every `var-filters=cluster|!=|X` value off the page URL. Drilldown
 * encodes a label-filter chip as `var-filters=<key>|<op>|<value>` (URL-encoded
 * pipes), so we look for the `cluster|!=|` prefix.
 */
function extractClusterExcludesFromPageUrl(pageUrl: string): Set<string> {
  const out = new Set<string>();
  try {
    const params = new URL(pageUrl).searchParams.getAll('var-filters');
    for (const raw of params) {
      const parts = raw.split('|');
      if (parts.length >= 3 && parts[0] === 'cluster' && parts[1] === '!=') {
        const value = parts.slice(2).join('|').trim();
        if (value) {
          out.add(value);
        }
      }
    }
  } catch {
    // ignore malformed URLs
  }
  return out;
}
