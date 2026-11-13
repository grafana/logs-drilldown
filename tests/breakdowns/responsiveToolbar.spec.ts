import { expect } from '@playwright/test';

import { test } from '@grafana/plugin-e2e';

import { testIds } from '../../src/services/testIds';
import { ExplorePage } from '../fixtures/explore';

import { setupServiceBreakdownTest, teardownServiceBreakdownTest } from './shared';

for (const tab of ['labels', 'fields'] as const) {
  test.describe(`${tab} responsive toolbar`, () => {
    let explorePage: ExplorePage;

    test.beforeEach(async ({ page, grafanaVersion }, testInfo) => {
      explorePage = await setupServiceBreakdownTest(page, grafanaVersion, testInfo);
      if (tab === 'labels') {
        await explorePage.goToLabelsTab();
      } else {
        await explorePage.goToFieldsTab();
      }
    });

    test.afterEach(async () => {
      await teardownServiceBreakdownTest(explorePage);
    });

    for (const width of [320, 375, 480, 1280]) {
      test(`keeps controls accessible at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        const toolbar = page.getByTestId(testIds.breakdowns.common.toolbar);
        const selector = toolbar.getByTestId(testIds.breakdowns.labelFieldSearch);
        const volume = toolbar.getByTestId(testIds.breakdowns.common.displayVolumeToggle);
        const volumeLabel = toolbar.getByTestId(testIds.breakdowns.common.displayVolumeLabel);
        const parserLabel = toolbar.getByTestId(testIds.breakdowns.fields.extractFieldsLabel);
        const layout = toolbar.getByTestId(testIds.breakdowns.common.layoutSwitcher);
        const parser = toolbar.getByTestId(testIds.breakdowns.fields.extractFieldsToggle);
        const controls =
          tab === 'fields' ? [selector, volumeLabel, parserLabel, layout] : [selector, volumeLabel, layout];
        const switches = tab === 'fields' ? [volume, parser] : [volume];

        await expect(volume).toBeChecked();
        await expect(async () => {
          const bounds = [];
          for (const control of [...controls, ...switches]) {
            await expect(control).toBeVisible();
            const box = await control.boundingBox();
            if (!box) {
              throw new Error('Toolbar control has no bounds');
            }
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(width);
            bounds.push(box);
          }
          const orderedBounds = bounds.slice(0, controls.length);
          for (let i = 1; i < orderedBounds.length; i++) {
            const previous = orderedBounds[i - 1];
            const current = orderedBounds[i];
            if (width < 768) {
              expect(current.y).toBeGreaterThanOrEqual(previous.y + previous.height);
            } else {
              expect(current.x).toBeGreaterThanOrEqual(previous.x + previous.width);
            }
          }
        }).toPass();

        const rows = layout.getByRole('radio', { name: 'Rows', exact: true });
        await rows.check();
        await expect(rows).toBeChecked();
        await layout.getByRole('radio', { name: 'Grid', exact: true }).check();
        await volumeLabel.click();
        await expect(volume).not.toBeChecked();
        await expect(layout).toBeHidden();
        await volumeLabel.click();
        await expect(layout).toBeVisible();

        if (tab === 'fields') {
          await expect(parser).toBeChecked();
          await parserLabel.click();
          await expect(parser).not.toBeChecked();
          await parserLabel.click();
          await expect(parser).toBeChecked();
        }
      });
    }
  });
}
