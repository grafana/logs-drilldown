import { DataFrame, FieldType, GrafanaTheme2, MappingType, ValueMap } from '@grafana/data';
import { config } from '@grafana/runtime';
import { SceneObject } from '@grafana/scenes';
import { SeriesVisibilityChangeMode } from '@grafana/ui';

import { isOperatorExclusive, isOperatorInclusive } from './operatorHelpers';
import { UNKNOWN_LEVEL_LOGS } from './panel';
import { getLevelsVariable } from './variableGetters';
import { LEVEL_VARIABLE_VALUE, VAR_LEVELS } from './variables';
import { addToFilters, FilterType } from 'Components/ServiceScene/Breakdowns/AddToFiltersButton';

/**
 * Given a set of `visibleLevels` in a panel, it returns a list of the new visible levels
 * after applying the visibility change in `mode`.
 */
export function toggleLevelVisibility(
  level: string,
  visibleLevels: string[] | undefined,
  mode: SeriesVisibilityChangeMode,
  allLevels: string[]
) {
  if (mode === SeriesVisibilityChangeMode.ToggleSelection) {
    const levels = visibleLevels ?? [];
    if (levels.length === 1 && levels.includes(level)) {
      return [];
    }
    return [level];
  }
  /**
   * When the behavior is `AppendToSelection` and the filter is empty, we initialize it
   * with all levels because the user is excluding this level in their action.
   */
  let levels = !visibleLevels?.length ? allLevels : visibleLevels;
  if (levels.includes(level)) {
    return levels.filter((existingLevel) => existingLevel !== level);
  }

  return [...levels, level];
}

export function getLevelLabelsFromSeries(series: DataFrame[]) {
  return series.map((dataFrame) => getLabelValueFromDataFrame(dataFrame) ?? UNKNOWN_LEVEL_LOGS);
}

export function getLabelValueFromDataFrame(frame: DataFrame) {
  const valueField = frame.fields.find((field) => field.type === FieldType.number);
  const labels = valueField?.labels;

  if (!labels) {
    return null;
  }

  const keys = Object.keys(labels);
  if (keys.length === 0) {
    return null;
  }

  return labels[keys[0]];
}

/*
 * From the current state of the levels filter, return the level names that
 * the user wants to see.
 */
export function getVisibleLevels(allLevels: string[], sceneRef: SceneObject) {
  const levelsFilter = getLevelsVariable(sceneRef);
  const wantedLevels = levelsFilter.state.filters
    .filter((filter) => isOperatorInclusive(filter.operator))
    .map((filter) => filter.value.split('|').map(normalizeLevelName))
    .join('|');
  const unwantedLevels = levelsFilter.state.filters
    .filter((filter) => isOperatorExclusive(filter.operator))
    .map((filter) => filter.value.split('|').map(normalizeLevelName))
    .join('|');
  return allLevels.filter((level) => {
    if (unwantedLevels.includes(level)) {
      return false;
    }
    return wantedLevels.length === 0 || wantedLevels.includes(level);
  });
}

export function normalizeLevelName(level: string) {
  if (level === '""') {
    return UNKNOWN_LEVEL_LOGS;
  }
  return level;
}

// Single source of truth for log level colors, shared by the value mappings below and the
// timeseries field overrides in panel.ts (setLevelColorOverrides). Grafana named colors, which
// resolve per theme.
export const LEVEL_COLORS = {
  critical: 'semi-dark-purple',
  // dimgray fails WCAG AA contrast (~3.2:1) on dark backgrounds, so use a lighter gray in dark theme
  debug: config.theme2.isDark ? '#9e9e9e' : 'dimgray',
  error: 'semi-dark-red',
  info: 'semi-dark-blue',
  trace: 'light-blue',
  // matches LogLevelColor for unknown in grafana core logsModel.ts
  unknown: config.theme2.isDark ? '#8e8e8e' : '#bdc4cd',
  warn: 'semi-dark-orange',
} as const;

// Built lazily: levels.ts and panel.ts import each other, so UNKNOWN_LEVEL_LOGS may not be
// initialized yet at module scope.
let fieldMappings: ValueMap | undefined;

export const getFieldMappings = (): ValueMap => {
  fieldMappings ??= {
    options: {
      crit: {
        color: LEVEL_COLORS.critical,
        index: 1,
      },
      critical: {
        color: LEVEL_COLORS.critical,
        index: 0,
      },
      debug: {
        color: LEVEL_COLORS.debug,
        index: 8,
      },
      eror: {
        color: LEVEL_COLORS.error,
        index: 4,
      },
      err: {
        color: LEVEL_COLORS.error,
        index: 3,
      },
      error: {
        color: LEVEL_COLORS.error,
        index: 2,
      },
      info: {
        color: LEVEL_COLORS.info,
        index: 7,
      },
      // Matches UNKNOWN_LEVEL_FIELD_NAME_REGEX in panel.ts, which colors these darkgray
      [UNKNOWN_LEVEL_LOGS]: {
        color: LEVEL_COLORS.unknown,
        index: 10,
      },
      trace: {
        color: LEVEL_COLORS.trace,
        index: 9,
      },
      unknown: {
        color: LEVEL_COLORS.unknown,
        index: 11,
      },
      warn: {
        color: LEVEL_COLORS.warn,
        index: 6,
      },
      warning: {
        color: LEVEL_COLORS.warn,
        index: 5,
      },
    },
    type: MappingType.ValueToText,
  };
  return fieldMappings;
};

// The mappings hold Grafana named colors, which Grafana resolves for field configs but which are
// not valid CSS. Resolve through the theme before using one as a style value.
export function getLevelColor(level: string, theme: GrafanaTheme2): string | undefined {
  const color = getFieldMappings().options[normalizeLevelName(level)]?.color;
  return color ? theme.visualization.getColorByName(color) : undefined;
}

/**
 * Toggle a level from the filter state.
 * If the filter is empty, it's added.
 * If the filter exists but it's different, it's replaced.
 * If the filter exists, it's removed.
 */
export function toggleLevelFromFilter(level: string, sceneRef: SceneObject): FilterType {
  if (level === UNKNOWN_LEVEL_LOGS) {
    level = '""';
  }
  const levelFilter = getLevelsVariable(sceneRef);
  const empty = levelFilter.state.filters.length === 0;
  const filterExists = levelFilter.state.filters.find(
    (filter) => filter.value === level && isOperatorInclusive(filter.operator)
  );

  if (empty || !filterExists) {
    addToFilters(LEVEL_VARIABLE_VALUE, level, 'include', sceneRef, VAR_LEVELS);
    return 'include';
  } else {
    addToFilters(LEVEL_VARIABLE_VALUE, level, 'toggle', sceneRef, VAR_LEVELS);
    return 'toggle';
  }
}
