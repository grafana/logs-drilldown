import path from 'node:path';

import { test } from '@grafana/plugin-e2e';

import pluginJson from '../src/plugin.json';
import { ExplorePage } from './fixtures/explore';
import { captureExploreApiMocks } from './fixtures/captureExploreApiMocks';

/**
 * Records every API call the test suite needs into `tests/mocks/captured/*.json`
 * by walking through the same flows the specs themselves exercise. Each block
 * navigates to the page-under-test and triggers the requests the spec relies
 * on (logs panel, breakdowns, patterns, embed, etc.).
 *
 * Run against a live Loki backend with:
 *   PW_RECORD_EXPLORE_MOCKS=1 pnpm exec playwright test recordExploreMocks
 *
 * The captured data is then split into per-service `tests/mocks/labels/<svc>/`
 * fixtures by `tests/mocks/scripts/splitCaptured.ts` (run via `pnpm mocks:split`)
 * so `mockExploreApi.ts` can replay responses without a live Loki backend.
 */

const SUB_PATH = `/a/${pluginJson.id}`;

test.describe.configure({ mode: 'serial' });

test('record explore mocks', async ({ page }, testInfo) => {
  test.skip(!process.env.PW_RECORD_EXPLORE_MOCKS, 'Set PW_RECORD_EXPLORE_MOCKS=1 to enable API mock recording.');
  test.setTimeout(900000);

  const explorePage = new ExplorePage(page, testInfo);
  const recorder = await captureExploreApiMocks(page, path.join(process.cwd(), 'tests/mocks/captured'));

  await explorePage.setExtraTallViewportSize();
  await explorePage.clearLocalStorage();

  /** Click `Select <name>` once if present, drill-into & wait for panels, then go back. Skips silently if the button isn't there. */
  const drillIntoIfPresent = async (label: string) => {
    const selector = page.getByLabel(`Select ${label}`);
    if ((await selector.count()) === 0) {
      return;
    }
    await selector.first().click();
    await explorePage.assertPanelsNotLoading();
    await page.goBack();
    await explorePage.assertNotLoading();
  };

  // ---------------------------------------------------------------------------
  // 1. Services index — default landing page (volume, default labels, ts panels)
  // The recorder uses relative time ranges so it captures the live Loki's
  // current data; specs replay that data against the fixed snapshot window
  // defined in `tests/mocks/snapshotTime.ts`. Re-recording will require
  // updating SNAPSHOT_FROM_MS / SNAPSHOT_TO_MS to match the new window.
  // ---------------------------------------------------------------------------
  await explorePage.gotoServices('now-15m', 'now');
  await explorePage.assertNotLoading();

  // Search — drives volume queries with a `service_name=~"..."` filter
  await explorePage.servicesSearch.click();
  await explorePage.servicesSearch.pressSequentially('tempo-i');
  await page.waitForTimeout(500);
  await explorePage.servicesSearch.fill('');

  // Switch primary label to namespace so we get a captured volume response
  // aggregated by namespace too.
  await page.goto(
    `${SUB_PATH}/explore?patterns=%5B%5D&from=now-15m&to=now&var-ds=gdev-loki&var-filters=&var-primary_label=namespace%7C%3D~%7C.%2B`
  );
  await explorePage.assertNotLoading();
  await page.goto(`${SUB_PATH}/explore?from=now-15m&to=now`);
  await explorePage.assertNotLoading();

  // ---------------------------------------------------------------------------
  // 2. Tempo-distributor breakdown — primary fixture for most tests
  // ---------------------------------------------------------------------------
  await explorePage.gotoServicesBreakdownOldUrl('tempo-distributor', 'now-15m');
  await explorePage.assertNotLoading();
  await explorePage.assertTabsNotLoading();

  // Logs tab (default) — logs panel + table
  await explorePage.goToLogsTab();
  await explorePage.assertPanelsNotLoading();

  // Labels tab — captures cluster / detected_level / namespace value breakdowns
  await explorePage.goToLabelsTab();
  await explorePage.assertPanelsNotLoading();
  for (const label of ['cluster', 'detected_level', 'namespace']) {
    await drillIntoIfPresent(label);
  }

  // Fields tab — captures every field-aggregated breakdown
  await explorePage.goToFieldsTab();
  await explorePage.assertPanelsNotLoading();
  for (const fieldName of ['caller', 'bytes', 'pod', 'tenant', 'msg', 'err']) {
    await drillIntoIfPresent(fieldName);
  }

  // Patterns tab
  await explorePage.goToPatternsTab();
  await explorePage.assertPanelsNotLoading();

  // ---------------------------------------------------------------------------
  // 3. Tempo-ingester breakdown — used by appNavigation/savedSearches
  // ---------------------------------------------------------------------------
  await explorePage.gotoServicesBreakdownOldUrl('tempo-ingester', 'now-15m');
  await explorePage.assertNotLoading();
  await explorePage.assertTabsNotLoading();
  await explorePage.goToLabelsTab();
  await explorePage.assertPanelsNotLoading();
  await explorePage.goToFieldsTab();
  await explorePage.assertPanelsNotLoading();
  await explorePage.goToPatternsTab();
  await explorePage.assertPanelsNotLoading();

  // ---------------------------------------------------------------------------
  // 4. Nginx breakdown — needed by exploreServicesBreakDown empty-fields tests
  // ---------------------------------------------------------------------------
  await explorePage.gotoServicesBreakdownOldUrl('nginx', 'now-15m');
  await explorePage.assertNotLoading();
  await explorePage.goToLabelsTab();
  await explorePage.assertPanelsNotLoading();
  await explorePage.goToFieldsTab();
  await explorePage.assertPanelsNotLoading();

  // ---------------------------------------------------------------------------
  // 5. Nginx-json breakdown — JSON viz tests
  // ---------------------------------------------------------------------------
  await explorePage.gotoServicesBreakdownOldUrl('nginx-json', 'now-15m');
  await explorePage.assertNotLoading();
  await explorePage.assertTabsNotLoading();
  await explorePage.goToLogsTab();
  await explorePage.assertPanelsNotLoading();
  await explorePage.goToFieldsTab();
  await explorePage.assertPanelsNotLoading();
  for (const fieldName of ['method', 'status', 'url']) {
    await drillIntoIfPresent(fieldName);
  }

  // ---------------------------------------------------------------------------
  // 6. Nginx-json-mixed breakdown — mixed parser tests
  // ---------------------------------------------------------------------------
  await explorePage.gotoServicesBreakdownOldUrl('nginx-json-mixed', 'now-15m');
  await explorePage.assertNotLoading();
  await explorePage.goToFieldsTab();
  await explorePage.assertPanelsNotLoading();
  for (const fieldName of ['method', 'caller', 'status', 'pod']) {
    await drillIntoIfPresent(fieldName);
  }

  // ---------------------------------------------------------------------------
  // 7. Embed page — initial filters populated by the scene
  // ---------------------------------------------------------------------------
  await explorePage.gotoEmbedUrl('now-15m', 'now');
  await explorePage.assertNotLoading();
  await explorePage.assertTabsNotLoading();
  await explorePage.goToLabelsTab();
  await explorePage.assertPanelsNotLoading();
  await explorePage.goToFieldsTab();
  await explorePage.assertPanelsNotLoading();
  await explorePage.goToPatternsTab();
  await explorePage.assertPanelsNotLoading();
  await explorePage.goToLogsTab();
  await explorePage.assertPanelsNotLoading();

  await recorder.flush();
});
