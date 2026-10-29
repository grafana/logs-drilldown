# E2E Tests

This directory contains end-to-end (e2e) tests for the Grafana Logs Drilldown plugin.

## Static Loki snapshot (CI)

Playwright runs against a **pre-baked Loki dataset** in CI (`docker-compose.dev.yaml`). Snapshot assets, the regeneration script, and documentation live under [`tests/static-loki/README.md`](static-loki/README.md). Regenerate the zip with `pnpm run generate:loki-snapshot`.

## Local debugging and codegen (Playwright)

**Running Playwright locally (including `pnpm exec playwright test` and codegen) requires the same Grafana + static Loki stack that CI uses.** From the repository root, start it and wait until the containers are healthy:

```bash
pnpm server:ci
```

That command brings up `docker-compose.dev.yaml` (see [`package.json`](../package.json) `server:ci` script) so Grafana is available on port **3001** with the pre-baked Loki snapshot. Other compose setups (for example `pnpm server` or ad hoc `docker compose` without that file) may not match what the tests expect, which leads to missing data, wrong URLs, or flaky locators.

After the stack is up, sign in as the same user your Playwright auth uses (usually `admin`), then open the **Explore** URL that matches the static snapshot window and datasource used in tests (`STATIC_FROM` / `STATIC_TO` and `gdev-loki` in [`tests/config/constants.ts`](config/constants.ts)):

```text
http://localhost:3001/grafana/a/grafana-lokiexplore-app/explore?var-ds=gdev-loki&from=2026-04-26T11:00:00.000Z&to=2026-04-26T12:05:00.000Z
```

Use that URL to reproduce failures in the browser, or to record locators with codegen (from the repo root, after Grafana is reachable):

```bash
pnpm exec playwright codegen 'http://localhost:3001/grafana/a/grafana-lokiexplore-app/explore?var-ds=gdev-loki&from=2026-04-26T11:00:00.000Z&to=2026-04-26T12:05:00.000Z'
```

If you change the snapshot window in `constants.ts`, update this README and the URL so they stay aligned.

## Test Version Strategy

### Full Test Suite (`tests/`)

All tests in the `tests/` directory run on **every supported Grafana version**, i.e. `GRAFANA_LATEST_SUPPORTED_VERSION` or newer, as defined in /tests/config/grafana-versions-supported.ts. That constant equals the minimum version in `grafanaDependency` in `src/plugin.json`.

Tests use the `skipUnlessLatestGrafana` helper to skip execution on Grafana versions below that minimum (it checks `semver.gte`, so newer versions run too). Use it as a standalone `beforeEach` or call it first inside your own:

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
- The full suite covers every Grafana version the plugin supports, not just the newest
- Tests are skipped on versions below the plugin's minimum, where the plugin doesn't load
- CI runs the full suite once per resolved version in the supported range

### Smoke Tests (`smoke-tests/`)

Smoke tests in the `smoke-tests/` directory are designed to run on **all supported Grafana versions** (>= 13.2.0-0).

These tests:
- Verify basic functionality across different Grafana versions
- Ensure the plugin works on older versions without breaking changes
- Run without version-specific skip logic


## CI Configuration

In CI, tests are configured to run against Grafana versions `>=13.2.0-0`:

- **Full test suite**: Executes on all versions >= 13.2.0-0
- **Smoke tests**: Execute on all versions >= 13.2.0-0

This is configured in `.github/workflows/ci.yml` with:
```yaml
run-playwright-with-grafana-dependency: '>=13.2.0-0'
```

## Version Support

The minimum supported Grafana version (used as the full-suite gate) is defined in `tests/config/grafana-versions-supported.ts`:

```typescript
export const GRAFANA_LATEST_SUPPORTED_VERSION = '13.2.0';
```

This must match the minimum version in `grafanaDependency` in `src/plugin.json`. To update the supported version, change both and ensure all tests pass on the new version.

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

## Related Documentation

- [Playwright Documentation](https://playwright.dev/)
- [Grafana Plugin E2E Documentation](https://grafana.com/docs/grafana/latest/developers/plugins/test-a-plugin/)
