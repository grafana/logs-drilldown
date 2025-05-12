import { behaviors, SceneFlexItem, SceneFlexLayout, SceneObject } from '@grafana/scenes';
import { DashboardCursorSync } from '@grafana/schema';

import { PageSlugs, TabNames, ValueSlugs } from '../../services/enums';
import { testIds } from '../../services/testIds';
import { FieldsBreakdownScene } from './Breakdowns/FieldsBreakdownScene';
import { LabelBreakdownScene } from './Breakdowns/LabelBreakdownScene';
import { PatternsBreakdownScene } from './Breakdowns/Patterns/PatternsBreakdownScene';
import { LogsListScene } from './LogsListScene';
import { LogsVolumePanel } from './LogsVolumePanel';

interface ValueBreakdownViewDefinition {
  displayName: string;
  getScene: (value: string) => SceneObject;
  testId: string;
  value: ValueSlugs;
}

export interface BreakdownViewDefinition {
  displayName: TabNames;
  getScene: (changeFields: (f: number) => void) => SceneObject;
  testId: string;
  value: PageSlugs;
}

export const breakdownViewsDefinitions: BreakdownViewDefinition[] = [
  {
    displayName: TabNames.logs,
    getScene: () => buildLogsListScene(),
    testId: testIds.exploreServiceDetails.tabLogs,
    value: PageSlugs.logs,
  },
  {
    displayName: TabNames.labels,
    getScene: () => buildLabelBreakdownActionScene(),
    testId: testIds.exploreServiceDetails.tabLabels,
    value: PageSlugs.labels,
  },
  {
    displayName: TabNames.fields,
    getScene: (f) => buildFieldsBreakdownActionScene(f),
    testId: testIds.exploreServiceDetails.tabFields,
    value: PageSlugs.fields,
  },
  {
    displayName: TabNames.patterns,
    getScene: () => buildPatternsScene(),
    testId: testIds.exploreServiceDetails.tabPatterns,
    value: PageSlugs.patterns,
  },
];
export const valueBreakdownViews: ValueBreakdownViewDefinition[] = [
  {
    displayName: 'Label',
    getScene: (value: string) => buildLabelValuesBreakdownActionScene(value),
    testId: testIds.exploreServiceDetails.tabLabels,
    value: ValueSlugs.label,
  },
  {
    displayName: 'Field',
    getScene: (value: string) => buildFieldValuesBreakdownActionScene(value),
    testId: testIds.exploreServiceDetails.tabFields,
    value: ValueSlugs.field,
  },
];

function buildPatternsScene() {
  return new SceneFlexLayout({
    children: [
      new SceneFlexItem({
        body: new PatternsBreakdownScene({}),
      }),
    ],
  });
}

function buildFieldsBreakdownActionScene(changeFieldNumber: (n: number) => void) {
  return new SceneFlexLayout({
    $behaviors: [new behaviors.CursorSync({ key: 'sync', sync: DashboardCursorSync.Crosshair })],
    children: [
      new SceneFlexItem({
        body: new FieldsBreakdownScene({ changeFieldCount: changeFieldNumber }),
      }),
    ],
  });
}

function buildFieldValuesBreakdownActionScene(value: string) {
  return new SceneFlexLayout({
    $behaviors: [new behaviors.CursorSync({ key: 'sync', sync: DashboardCursorSync.Crosshair })],
    children: [
      new SceneFlexItem({
        body: new FieldsBreakdownScene({ value }),
      }),
    ],
  });
}

function buildLabelValuesBreakdownActionScene(value: string) {
  return new SceneFlexLayout({
    $behaviors: [new behaviors.CursorSync({ key: 'sync', sync: DashboardCursorSync.Crosshair })],
    children: [
      new SceneFlexItem({
        body: new LabelBreakdownScene({ value }),
      }),
    ],
  });
}

function buildLogsListScene() {
  return new SceneFlexLayout({
    children: [
      new SceneFlexItem({
        body: new LogsVolumePanel({}),
      }),
      new SceneFlexItem({
        body: new LogsListScene({}),
        height: 'calc(100vh - 500px)',
        minHeight: '470px',
      }),
    ],
    direction: 'column',
  });
}

function buildLabelBreakdownActionScene() {
  return new SceneFlexLayout({
    $behaviors: [new behaviors.CursorSync({ key: 'sync', sync: DashboardCursorSync.Crosshair })],
    children: [
      new SceneFlexItem({
        body: new LabelBreakdownScene({}),
      }),
    ],
  });
}
