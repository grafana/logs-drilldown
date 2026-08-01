import { DataFrame, FieldType, GrafanaTheme2, MappingType, ValueMap } from '@grafana/data';
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

export const getFieldMappings = (): ValueMap => {
  return {
    options: {
      crit: {
        color: 'semi-dark-purple',
        index: 1,
      },
      critical: {
        color: 'semi-dark-purple',
        index: 0,
      },
      debug: {
        color: 'super-light-purple',
        index: 8,
      },
      eror: {
        color: 'semi-dark-red',
        index: 4,
      },
      err: {
        color: 'semi-dark-red',
        index: 3,
      },
      error: {
        color: 'semi-dark-red',
        index: 2,
      },
      info: {
        color: 'blue',
        index: 7,
      },
      // Matches UNKNOWN_LEVEL_FIELD_NAME_REGEX in panel.ts, which colors these darkgray
      [UNKNOWN_LEVEL_LOGS]: {
        color: 'darkgray',
        index: 10,
      },
      trace: {
        color: 'light-blue',
        index: 9,
      },
      unknown: {
        color: 'darkgray',
        index: 11,
      },
      warn: {
        color: 'orange',
        index: 6,
      },
      warning: {
        color: 'orange',
        index: 5,
      },
    },
    type: MappingType.ValueToText,
  };
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
