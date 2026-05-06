import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { Page, Route } from '@playwright/test';

type CapturedEntry = {
  url: string;
  request?: unknown;
  response: unknown;
};

type CapturedExploreApi = {
  detectedLabels: CapturedEntry[];
  detectedFields: CapturedEntry[];
  detectedFieldValues: CapturedEntry[];
  labelValues: CapturedEntry[];
  labels: CapturedEntry[];
  patterns: CapturedEntry[];
  series: CapturedEntry[];
  volume: CapturedEntry[];
  defaultLabels: CapturedEntry[];
  drilldownLimits: CapturedEntry[];
  dsQuery: CapturedEntry[];
};

const createCapturedState = (): CapturedExploreApi => ({
  detectedLabels: [],
  detectedFields: [],
  detectedFieldValues: [],
  labelValues: [],
  labels: [],
  patterns: [],
  series: [],
  volume: [],
  defaultLabels: [],
  drilldownLimits: [],
  dsQuery: [],
});

/**
 * Captures live Explore API responses while still allowing normal app behavior.
 * Call `flush()` (usually in afterEach) to write files under `outputDir`.
 *
 * The captured files are consumed by `mockExploreApi.ts` to replay responses
 * in tests so they don't need a live Loki backend. Add new endpoints here when
 * you teach the mock layer about them.
 */
export async function captureExploreApiMocks(page: Page, outputDir: string) {
  const captured = createCapturedState();
  let isClosing = false;

  page.once('close', () => {
    isClosing = true;
  });

  /** Forward to the real backend, push the response into `bucket`, then fulfill. */
  const recordTo = async (route: Route, bucket: CapturedEntry[]) => {
    try {
      const response = await route.fetch();
      const json = await response.json();
      bucket.push({
        url: route.request().url(),
        request: route.request().postDataJSON?.() ?? undefined,
        response: json,
      });
      await route.fulfill({ response, json });
    } catch (error) {
      if (!isClosing) {
        throw error;
      }
    }
  };

  // Order matters: more specific patterns must be registered LAST so they
  // win over the broader siblings (Playwright matches handlers most-recent
  // first).
  await page.route('**/resources/labels*', (route) => recordTo(route, captured.labels));
  await page.route('**/resources/label/*/values*', (route) => recordTo(route, captured.labelValues));
  await page.route('**/resources/detected_labels*', (route) => recordTo(route, captured.detectedLabels));
  await page.route('**/resources/detected_fields*', (route) => recordTo(route, captured.detectedFields));
  await page.route('**/resources/detected_field/*/values*', (route) => recordTo(route, captured.detectedFieldValues));
  await page.route('**/resources/series*', (route) => recordTo(route, captured.series));
  await page.route('**/resources/patterns*', (route) => recordTo(route, captured.patterns));
  await page.route('**/index/volume*', (route) => recordTo(route, captured.volume));
  await page.route('**/resources/drilldown-limits*', (route) => recordTo(route, captured.drilldownLimits));
  await page.route('**/logsdrilldowndefaultlabels*', (route) => recordTo(route, captured.defaultLabels));
  await page.route('**/ds/query*', async (route) => {
    try {
      const response = await route.fetch();
      const json = await response.json();
      captured.dsQuery.push({
        url: route.request().url(),
        request: route.request().postDataJSON(),
        response: json,
      });
      await route.fulfill({ response, json });
    } catch (error) {
      if (!isClosing) {
        throw error;
      }
    }
  });

  return {
    captured,
    flush: async () => {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await mkdir(outputDir, { recursive: true });
      const writes: Array<[string, CapturedEntry[]]> = [
        ['detected_labels.json', captured.detectedLabels],
        ['detected_fields.json', captured.detectedFields],
        ['detected_field_values.json', captured.detectedFieldValues],
        ['label_values.json', captured.labelValues],
        ['labels.json', captured.labels],
        ['patterns.json', captured.patterns],
        ['series.json', captured.series],
        ['volume.json', captured.volume],
        ['default_labels.json', captured.defaultLabels],
        ['drilldown_limits.json', captured.drilldownLimits],
        ['ds_query.json', captured.dsQuery],
      ];
      await Promise.all(
        writes.map(([fileName, entries]) => writeFile(path.join(outputDir, fileName), JSON.stringify(entries, null, 2)))
      );
    },
  };
}
