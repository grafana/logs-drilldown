# E2E Tests

This directory contains end-to-end (e2e) tests for the Grafana Logs Drilldown plugin.

## Test Version Strategy

### Full Test Suite (`tests/`)

All tests in the `tests/` directory are configured to run **only on the latest supported Grafana version** in /tests/config/grafana-versions-supported.ts.

Tests use the `isLatestGrafana()` helper to skip execution on older Grafana versions:

```typescript
test.beforeEach(async ({ page, grafanaVersion }, testInfo) => {
  test.skip(!isLatestGrafana(grafanaVersion), `Skipping: requires Grafana >= ${GRAFANA_LATEST_SUPPORTED_VERSION}`);
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
export const GRAFANA_LATEST_SUPPORTED_VERSION = '12.3.1';
```

To update the supported version, modify this constant and ensure all tests pass on the new version.

## Writing New Tests

When writing new tests:

1. **For full test suite** (`tests/`): Add the version skip check in `beforeEach`
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
