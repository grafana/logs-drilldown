import { FieldConfig } from '@grafana/data';
import { config } from '@grafana/runtime';
import { FieldConfigOverridesBuilder, PanelBuilders, SceneQueryRunner, VizPanel } from '@grafana/scenes';
import { LogsDedupStrategy, LogsSortOrder } from '@grafana/schema';
import { colors, DrawStyle, LegendDisplayMode, StackingMode } from '@grafana/ui';

import { MAX_NUMBER_OF_TIME_SERIES } from 'Components/ServiceScene/Breakdowns/TimeSeriesLimit';

// Local, decoupled copy of services/levels.ts's LEVEL_COLORS + services/panel.ts's
// setLevelColorOverrides: those files transitively import Components/ServiceScene/Breakdowns and
// Components/ServiceScene/ServiceScene, which would pull the whole main scene tree into this
// from-scratch, lazy-loaded chunk.
const LEVEL_COLORS = {
  critical: 'semi-dark-purple',
  debug: config.theme2.isDark ? '#9e9e9e' : 'dimgray',
  error: 'semi-dark-red',
  info: 'semi-dark-blue',
  trace: colors[2],
  unknown: config.theme2.isDark ? '#8e8e8e' : '#bdc4cd',
  warn: 'semi-dark-orange',
} as const;

const LEVEL_FIELD_NAME_REGEX: Record<keyof typeof LEVEL_COLORS, RegExp> = {
  critical: /^(crit|critical|fatal|severe)$/i,
  debug: /^debug$/i,
  error: /^(error|errors)$/i,
  info: /^info$/i,
  trace: /^trace$/i,
  unknown: /^(logs|unknown)$/i,
  warn: /^(warn|warning)$/i,
};

function setLevelColorOverrides(overrides: FieldConfigOverridesBuilder<FieldConfig>) {
  for (const level of Object.keys(LEVEL_COLORS) as Array<keyof typeof LEVEL_COLORS>) {
    overrides.matchFieldsWithNameByRegex(LEVEL_FIELD_NAME_REGEX[level].toString()).overrideColor({
      fixedColor: LEVEL_COLORS[level],
      mode: 'fixed',
    });
  }
}

export function buildVolumePanel(queryRunner: SceneQueryRunner): VizPanel {
  return PanelBuilders.timeseries()
    .setTitle('Logs volume')
    .setOption('legend', { calcs: ['sum'], displayMode: LegendDisplayMode.List, showLegend: true })
    .setDisplayMode('default')
    .setUnit('short')
    .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
    .setCustomFieldConfig('fillOpacity', 100)
    .setCustomFieldConfig('lineWidth', 0)
    .setCustomFieldConfig('pointSize', 0)
    .setCustomFieldConfig('axisSoftMin', 0)
    .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
    .setSeriesLimit(MAX_NUMBER_OF_TIME_SERIES)
    .setOverrides(setLevelColorOverrides)
    .setData(queryRunner)
    .build();
}

export interface LogsPanelOptions {
  enableLogDetails?: boolean;
}

export function buildLogsPanel(queryRunner: SceneQueryRunner, options?: LogsPanelOptions): VizPanel {
  return PanelBuilders.logs()
    .setTitle('Logs')
    .setOption('showTime', true)
    .setOption('sortOrder', LogsSortOrder.Descending)
    .setOption('dedupStrategy', LogsDedupStrategy.none)
    .setOption('wrapLogMessage', false)
    .setOption('prettifyLogMessage', false)
    .setOption('enableInfiniteScrolling', true)
    .setOption('enableLogDetails', options?.enableLogDetails ?? true)
    .setData(queryRunner)
    .build();
}

// Core Grafana's generic table panel, not the main app's bespoke logstable panel (which is tightly
// coupled to ServiceScene/Breakdowns) — a light, no-frills default rather than a feature match.
export function buildTablePanel(queryRunner: SceneQueryRunner): VizPanel {
  return PanelBuilders.table().setTitle('Logs').setData(queryRunner).build();
}
