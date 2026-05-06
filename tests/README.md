# E2E Tests

This directory contains end-to-end (e2e) tests for the Grafana Logs Drilldown plugin.

## Test Version Strategy

### Full Test Suite (`tests/`)

All tests in the `tests/` directory are configured to run **only on the latest supported Grafana version** in /tests/config/grafana-versions-supported.ts.

Tests use the `skipUnlessLatestGrafana` helper to skip execution on older Grafana versions. Use it as a standalone `beforeEach` or call it first inside your own:

```typescript
import { skipUnlessLatestGrafana } from './config/grafana-versions-supported';

// Only version check:
test.beforeEach(skipUnlessLatestGrafana);

// With other setup:
test.beforeEach(async ({ page, grafanaVersion }, testInfo) => {
  skipUnlessLatestGrafana({ grafanaVersion });
  // ... test setup
});
```

This ensures that:
- Tests run against the most recent Grafana features and APIs
- Test maintenance is focused on the latest version
- CI runs efficiently by skipping tests on older versions

### Smoke Tests (`smoke-tests/`)

Smoke tests in the `smoke-tests/` directory are designed to run on **all supported Grafana versions** (>= 11.6).

These tests:
- Verify basic functionality across different Grafana versions
- Ensure the plugin works on older versions without breaking changes
- Run without version-specific skip logic


## CI Configuration

In CI, tests are configured to run against Grafana versions `>=11.6`:

- **Full test suite**: Only executes on the latest supported version 
- **Smoke tests**: Execute on all versions >= 11.6

This is configured in `.github/workflows/ci.yml` with:
```yaml
run-playwright-with-grafana-dependency: '>=11.6'
```

## Version Support

The latest supported Grafana version is defined in `tests/config/grafana-versions-supported.ts`:

```typescript
export const GRAFANA_LATEST_SUPPORTED_VERSION = '13.0.1';
```

To update the supported version, modify this constant and ensure all tests pass on the new version.

## Writing New Tests

When writing new tests:

1. **For full test suite** (`tests/`): Add `test.beforeEach(skipUnlessLatestGrafana)` or call `skipUnlessLatestGrafana({ grafanaVersion })` first in your `beforeEach`
2. **For smoke tests** (`smoke-tests/`): No version skip logic needed
3. **Use fixtures**: Leverage `ExplorePage` and other fixtures for common operations
4. **Guard afterEach**: Always check if `explorePage` exists before cleanup:

```typescript
test.afterEach(async ({ page }) => {
  if (!explorePage) return;
  await explorePage.unroute();
  explorePage.echoConsoleLogsOnRetry();
});
```

## API Mocks

Tests run against a Grafana stack with **no Loki backend** (`docker-compose.playwright.yaml`). Loki responses are replayed from JSON fixtures captured against a real Loki, so every spec is fast, deterministic, and offline-capable.

### Folder layout

```
tests/mocks/
├── snapshotTime.ts                     ← shared fixed time constants
├── captured/                           ← raw recordings (gitignored, local-only)
│   ├── ds_query.json                   ← can exceed 100 MB; never commit
│   ├── volume.json
│   ├── patterns.json
│   └── ... (detected_labels, detected_fields, label_values, ...)
├── labels/
│   ├── _global/                        ← service-less data (volume, labels, defaults)
│   ├── service_name-tempo-distributor/ ← per-service slice
│   │   ├── dsQuery.json
│   │   ├── labelsBreakdown.json
│   │   ├── detectedFields.ts
│   │   ├── detectedLabels.ts
│   │   ├── labelValues.ts
│   │   ├── fieldValues.ts
│   │   ├── patterns.ts
│   │   └── index.ts                    ← re-exports the slice
│   ├── service_name-tempo-ingester/    ← (default service in `mockExploreApi`)
│   ├── service_name-nginx/
│   ├── service_name-nginx-json/
│   ├── service_name-nginx-json-mixed/
│   ├── namespace-gateway/              ← non-`service_name` primary labels work too
│   └── namespace-mimir/
├── scenarios/                          ← per-test route loaders (layered on the default)
│   ├── _util.ts                        ← `buildDsQueryHandler`, `extractPathSegment`, etc.
│   ├── loadBreakdownTempoDistributor.ts
│   ├── loadBreakdownNginx.ts
│   ├── loadServiceSelectionFilterTempoI.ts
│   └── ...
└── scripts/
    └── splitCaptured.ts                ← splits `captured/*.json` into per-service folders
```

### Runtime model

Three layers, all pure `page.route(...)` registrations:

1. **`mockExploreApi(page)`** ([tests/fixtures/mockExploreApi.ts](fixtures/mockExploreApi.ts)) — the default scenario. Wires up `_global` static endpoints (`/index/volume`, `/resources/labels`, `/resources/series`, `/resources/drilldown-limits`, `/logsdrilldowndefaultlabels`) plus the `tempo-ingester` per-service endpoints (`/resources/detected_fields`, `/resources/detected_labels`, `/resources/patterns`, `/resources/label/*/values`, `/resources/detected_field/*/values`). `/ds/query` is dispatched by `buildDsQueryHandler` against both `_global` and `tempo-ingester` refIds; unknown refIds return empty frames.

2. **Scenario loaders** in `tests/mocks/scenarios/` — layer on top by re-registering the same routes for a different service or shape (e.g. `loadBreakdownTempoDistributor(page)` swaps the per-service endpoints from `tempo-ingester` to `tempo-distributor` data). Playwright runs handlers most-recently-registered first, so the new handler shadows the default. A handler can call `route.fallback()` to defer back to the default underneath.

3. **Test-local route overrides** for one-off cases — most often `page.route('**/ds/query*', ...)` inline in a test to count requests or stub a specific refId. Same fallback rules apply.

```ts
test.beforeEach(async ({ page }) => {
  await mockExploreApi(page);                       // layer 1: default
  await loadBreakdownTempoDistributor(page);        // layer 2: scenario
});

test('something', async ({ page }) => {
  await page.route('**/ds/query*', async (route) => { /* layer 3: spec-local */ });
});
```

### Fixed snapshot time

All navigation URLs use an absolute `from`/`to` epoch range (defined in [`tests/mocks/snapshotTime.ts`](mocks/snapshotTime.ts)) that exactly matches the captured data window. Helpers in [`tests/fixtures/explore.ts`](fixtures/explore.ts) (`gotoServices`, `gotoServicesBreakdownOldUrl`, `gotoEmbedUrl`, `gotoLogsPanel`) inject this by default. Why:

- Static mocks always sit inside the active time range — no "Data outside time range" / "Zoom to data" rendering.
- Nothing in the suite depends on `Date.now()`; runs are reproducible day-to-day.
- The plugin's source-side `DEFAULT_TIME_RANGE = { from: 'now-15m', to: 'now' }` is overridden by URL params on mount via Scenes URL sync, including for the embed page.

Two exceptions intentionally use relative time:
- `tests/recordExploreMocks.spec.ts` — runs against live Loki, needs `now-15m`/`now` to capture current data.
- `tests/exploreServices.spec.ts` "refreshing time range should request panel data once" — the test's whole point is that each refresh advances `now` by >1s and re-runs queries.

### Adding mocks for a new service or scenario

1. **Capture against live Loki.** With a real Loki running on `localhost:3100`, run:

   ```bash
   PW_RECORD_EXPLORE_MOCKS=1 pnpm exec playwright test recordExploreMocks
   ```

   This walks through every flow the suite exercises (services index, breakdowns for each service, embed page) and writes raw responses to `tests/mocks/captured/*.json`. To capture a new flow, add a navigation block to [`tests/recordExploreMocks.spec.ts`](recordExploreMocks.spec.ts) before re-running.

   `tests/mocks/captured/` is **gitignored** — `ds_query.json` typically exceeds GitHub's 100 MB single-file limit. Only the per-service slices produced in step 2 are committed.

2. **Split into per-service fixtures.**

   ```bash
   pnpm mocks:split
   ```

   [`tests/mocks/scripts/splitCaptured.ts`](mocks/scripts/splitCaptured.ts) parses each captured response, extracts `service_name="..."` from the LogQL expression or URL, and writes the data into `tests/mocks/labels/service_name-<svc>/`. Service-less responses (e.g. `service_name=~"a|b"`) land in `_global/`. New service folders are created automatically.

3. **Update the snapshot time.** Open [`tests/mocks/snapshotTime.ts`](mocks/snapshotTime.ts) and set `SNAPSHOT_TO_MS` to the end of the new capture window (peek at the `from`/`to` in `tests/mocks/captured/ds_query.json`'s first request body) and `SNAPSHOT_FROM_MS` to 15 minutes earlier. All tests will line up with the new data automatically.

4. **(Optional) Add a scenario loader.** If a test needs a service or page state that the default `mockExploreApi` doesn't cover, add a file in `tests/mocks/scenarios/` that imports the per-service slice and registers the routes. Pattern to follow:

   ```ts
   // tests/mocks/scenarios/loadBreakdownNginx.ts
   import {
     detectedFields, detectedLabels, dsQuery, fieldValues,
     labelsBreakdown, labelValues, patterns,
   } from '../labels/service_name-nginx';
   import { buildDsQueryHandler, extractPathSegment } from './_util';

   export async function loadBreakdownNginx(page: Page) {
     await page.route('**/resources/detected_fields*', (r) => r.fulfill({ json: detectedFields }));
     await page.route('**/resources/detected_labels*', (r) => r.fulfill({ json: detectedLabels }));
     await page.route('**/resources/patterns*', (r) => r.fulfill({ json: patterns }));
     await page.route('**/resources/label/*/values*', (r) => {
       const name = extractPathSegment(r.request().url(), 'label');
       return r.fulfill({ json: { status: 'success', data: name ? (labelValues[name] ?? []) : [] } });
     });
     await page.route('**/resources/detected_field/*/values*', (r) => {
       const name = extractPathSegment(r.request().url(), 'detected_field');
       return r.fulfill({ json: { values: name ? (fieldValues[name] ?? []) : [] } });
     });
     await page.route('**/ds/query*', buildDsQueryHandler({ dsQuery, labelsBreakdown }));
   }
   ```

5. **(Optional) Add a *dynamic* scenario** when a test interacts with the UI in a way that triggers a follow-up Loki query whose response wasn't captured (e.g. a caller-regex filter, a series-limit warning suppress, a logs-context fetch). Look at `tests/mocks/scenarios/loadBreakdownTempoDistributorWithLevelInfo.ts` or `loadBreakdownTempoDistributorCallerRegexFilter.ts` for the pattern: parse the LogQL `expr` from the request, filter or synthesize frames inline, and `route.fulfill(...)`. Keep this logic isolated to the scenario file.

### Common pitfalls

- **New endpoint added to the plugin** — first add a route handler to [`tests/fixtures/captureExploreApiMocks.ts`](fixtures/captureExploreApiMocks.ts) so the recorder writes a JSON file, then teach `mockExploreApi.ts` and any relevant scenarios to serve it.
- **Test depends on `Date.now()`** — anchor synthesized timestamps to `SNAPSHOT_TO_MS` instead, mirroring `loadBreakdownTempoDistributorLogsContext.ts` / `loadBreakdownTempoDistributorPatternSample.ts`.
- **Recording produces new timestamps** — re-recording always shifts the snapshot window. Update [`tests/mocks/snapshotTime.ts`](mocks/snapshotTime.ts) in the same commit as the new fixtures.

## Local Docker stack

E2E tests run against a Grafana-only stack defined in `docker-compose.playwright.yaml` (no Loki, no generator, ~200 MB idle). Bring it up with:

```bash
pnpm server:playwright       # foreground
# or
pnpm start:playwright        # background + run dev mode
pnpm server:playwright:down  # tear down
```

Then run:

```bash
pnpm e2e          # full suite, workers=5  (~2.5 min)
pnpm e2e:fast     # full suite, workers=10 (deliberate "push it" mode)
pnpm e2e:matrix   # matrix (multi-version) suite
pnpm e2e:smoke    # smoke; needs GRAFANA_URL=http://localhost:3001 set locally
```

If `pnpm e2e` starts timing out, check `docker stats` — if a second Docker stack is also up, Grafana hits memory pressure and `page.goto` calls slow past 30s. Stop the duplicate stack or bump Docker Desktop memory to 12+ GB.

## Related Documentation

- [Playwright Documentation](https://playwright.dev/)
- [Grafana Plugin E2E Documentation](https://grafana.com/docs/grafana/latest/developers/plugins/test-a-plugin/)
