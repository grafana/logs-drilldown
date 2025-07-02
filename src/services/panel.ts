import { map, Observable } from 'rxjs';

import {
  DataFrame,
  FieldColorModeId,
  FieldConfig,
  FieldMatcherID,
  FieldType,
  getFieldDisplayName,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  FieldConfigBuilder,
  FieldConfigBuilders,
  FieldConfigOverridesBuilder,
  PanelBuilders,
  QueryRunnerState,
  SceneDataProvider,
  SceneDataTransformer,
  SceneObject,
  SceneQueryRunner,
  VizPanel,
} from '@grafana/scenes';
import { HideSeriesConfig, LogsSortOrder } from '@grafana/schema';
import { DrawStyle, StackingMode } from '@grafana/ui';

import { SPARSITY_CARDINALITY_FIELD_NAME } from '../Components/ServiceScene/Breakdowns/FieldsAggregatedBreakdownScene';
import { LOGS_COUNT_QUERY_REFID, LOGS_PANEL_QUERY_REFID } from '../Components/ServiceScene/ServiceScene';
import { WRAPPED_LOKI_DS_UID } from './datasource';
import { getParserForField } from './fields';
import { getLabelsFromSeries, getVisibleFields, getVisibleLabels, getVisibleMetadata } from './labels';
import { getLevelLabelsFromSeries, getVisibleLevels } from './levels';
import { LokiQuery, LokiQueryDirection } from './lokiQuery';
import { getLogOption } from './store';
import { getLogsPanelSortOrderFromURL } from 'Components/ServiceScene/LogOptionsScene';

const UNKNOWN_LEVEL_LOGS = 'logs';
export const INFO_LEVEL_FIELD_NAME_REGEX = /^info$/i;
export const DEBUG_LEVEL_FIELD_NAME_REGEX = /^debug$/i;
export const WARNING_LEVEL_FIELD_NAME_REGEX = /^(warn|warning)$/i;
export const ERROR_LEVEL_FIELD_NAME_REGEX = /^error$/i;
export const CRITICAL_LEVEL_FIELD_NAME_REGEX = /^(crit|critical|fatal)$/i;
export const UNKNOWN_LEVEL_FIELD_NAME_REGEX = /^(logs|unknown)$/i;

export function setLevelColorOverrides(overrides: FieldConfigOverridesBuilder<FieldConfig>) {
  overrides.matchFieldsWithNameByRegex(INFO_LEVEL_FIELD_NAME_REGEX.source).overrideColor({
    fixedColor: 'semi-dark-green',
    mode: 'fixed',
  });
  overrides.matchFieldsWithNameByRegex(DEBUG_LEVEL_FIELD_NAME_REGEX.source).overrideColor({
    fixedColor: 'semi-dark-blue',
    mode: 'fixed',
  });
  overrides.matchFieldsWithNameByRegex(WARNING_LEVEL_FIELD_NAME_REGEX.source).overrideColor({
    fixedColor: 'semi-dark-orange',
    mode: 'fixed',
  });
  overrides.matchFieldsWithNameByRegex(ERROR_LEVEL_FIELD_NAME_REGEX.source).overrideColor({
    fixedColor: 'semi-dark-red',
    mode: 'fixed',
  });
  overrides.matchFieldsWithNameByRegex(CRITICAL_LEVEL_FIELD_NAME_REGEX.source).overrideColor({
    fixedColor: '#705da0',
    mode: 'fixed',
  });
  overrides.matchFieldsWithNameByRegex(UNKNOWN_LEVEL_FIELD_NAME_REGEX.source).overrideColor({
    fixedColor: 'darkgray',
    mode: 'fixed',
  });
}

export function setGaugeUnitOverrides(overrides: FieldConfigOverridesBuilder<FieldConfig>) {
  return overrides.matchFieldsWithName(SPARSITY_CARDINALITY_FIELD_NAME).overrideUnit('%');
}

export function setLogsVolumeFieldConfigs(
  builder: ReturnType<typeof PanelBuilders.timeseries> | ReturnType<typeof FieldConfigBuilders.timeseries>
) {
  return builder
    .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
    .setCustomFieldConfig('fillOpacity', 100)
    .setCustomFieldConfig('lineWidth', 0)
    .setCustomFieldConfig('pointSize', 0)
    .setCustomFieldConfig('axisSoftMin', 0)
    .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
    .setOverrides(setLevelColorOverrides);
}

export function setValueSummaryFieldConfigs(
  builder: ReturnType<typeof PanelBuilders.timeseries> | ReturnType<typeof FieldConfigBuilders.timeseries>
) {
  return builder
    .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
    .setCustomFieldConfig('fillOpacity', 100)
    .setCustomFieldConfig('lineWidth', 0)
    .setCustomFieldConfig('pointSize', 0)
    .setCustomFieldConfig('drawStyle', DrawStyle.Bars);
}

interface TimeSeriesFieldConfig extends FieldConfig {
  hideFrom: HideSeriesConfig;
}

export function setLabelSeriesOverrides(labels: string[], overrideConfig: FieldConfigOverridesBuilder<FieldConfig>) {
  overrideConfig
    .match({
      id: FieldMatcherID.byNames,
      options: {
        mode: 'exclude',
        names: labels,
        prefix: 'All except:',
        readOnly: true,
      },
    })
    .overrideCustomFieldConfig<TimeSeriesFieldConfig, 'hideFrom'>('hideFrom', {
      legend: false,
      tooltip: false,
      viz: true,
    });

  // Setting __systemRef to hideSeriesFrom, allows the override to be changed by interacting with the viz
  const overrides = overrideConfig.build();
  // @ts-expect-error
  overrides[overrides.length - 1].__systemRef = 'hideSeriesFrom';
}

/**
 * Sets labels series visibility in the panel
 */
export function syncLevelsVisibleSeries(panel: VizPanel, series: DataFrame[], sceneRef: SceneObject) {
  const focusedLevels = getVisibleLevels(getLevelLabelsFromSeries(series), sceneRef);
  const config = setLogsVolumeFieldConfigs(FieldConfigBuilders.timeseries()).setOverrides(
    setLabelSeriesOverrides.bind(null, focusedLevels)
  );
  if (config instanceof FieldConfigBuilder && panel.getPlugin()) {
    panel.onFieldConfigChange(config.build(), true);
  }
}

/**
 * @todo unit test
 * Set levels series visibility in the panel
 */
export function syncLabelsValueSummaryVisibleSeries(
  key: string,
  panel: VizPanel,
  series: DataFrame[],
  sceneRef: SceneObject
) {
  const allLabels = getLabelsFromSeries(series);
  const focusedLabels = getVisibleLabels(key, allLabels, sceneRef);

  const config = setValueSummaryFieldConfigs(FieldConfigBuilders.timeseries());
  if (focusedLabels.length) {
    config.setOverrides(setLabelSeriesOverrides.bind(null, focusedLabels));
  }
  if (config instanceof FieldConfigBuilder) {
    panel.onFieldConfigChange(config.build(), true);
  }
}

/**
 * Set fields series visibility in the panel
 */
export function syncFieldsValueSummaryVisibleSeries(
  key: string,
  panel: VizPanel,
  series: DataFrame[],
  sceneRef: SceneObject
) {
  const allLabels = getLabelsFromSeries(series);
  const detectedFieldType = getParserForField(key, sceneRef);

  const focusedLabels =
    detectedFieldType === 'structuredMetadata'
      ? getVisibleMetadata(key, allLabels, sceneRef)
      : getVisibleFields(key, allLabels, sceneRef);

  const config = setValueSummaryFieldConfigs(FieldConfigBuilders.timeseries());

  if (focusedLabels.length) {
    config.setOverrides(setLabelSeriesOverrides.bind(null, focusedLabels));
  }
  if (config instanceof FieldConfigBuilder) {
    panel.onFieldConfigChange(config.build(), true);
  }
}

function setColorByDisplayNameTransformation() {
  return (source: Observable<DataFrame[]>) => {
    return source.pipe(
      map((data: DataFrame[]) => {
        return data.map((frame, frameIndex) => {
          return {
            ...frame,
            fields: frame.fields.map((f, fieldIndex) => {
              // Time fields do not have color config
              if (f.type === FieldType.time) {
                return f;
              }
              const displayName = getFieldDisplayName(f, frame, data);
              return {
                ...f,
                config: {
                  ...f.config,
                  color: {
                    mode: FieldColorModeId.PaletteClassicByName,
                  },
                  displayName,
                },
              };
            }),
          };
        });
      })
    );
  };
}

export function sortLevelTransformation() {
  return (source: Observable<DataFrame[]>) => {
    return source.pipe(
      map((data: DataFrame[]) => {
        return data
          .map((d) => {
            if (d.fields.length < 2) {
              return d;
            }
            if (!d.fields[1].config.displayNameFromDS) {
              d.fields[1].config.displayNameFromDS = UNKNOWN_LEVEL_LOGS;
            }
            return d;
          })
          .sort((a, b) => {
            if (a.fields.length < 2 || b.fields.length < 2) {
              return 0;
            }
            const aName: string | undefined = a.fields[1].config.displayNameFromDS;
            const aVal = aName?.match(CRITICAL_LEVEL_FIELD_NAME_REGEX)
              ? 5
              : aName?.match(ERROR_LEVEL_FIELD_NAME_REGEX)
              ? 4
              : aName?.match(WARNING_LEVEL_FIELD_NAME_REGEX)
              ? 3
              : aName?.match(DEBUG_LEVEL_FIELD_NAME_REGEX)
              ? 2
              : aName?.match(INFO_LEVEL_FIELD_NAME_REGEX)
              ? 2
              : 1;
            const bName: string | undefined = b.fields[1].config.displayNameFromDS;
            const bVal = bName?.match(CRITICAL_LEVEL_FIELD_NAME_REGEX)
              ? 5
              : bName?.match(ERROR_LEVEL_FIELD_NAME_REGEX)
              ? 4
              : bName?.match(WARNING_LEVEL_FIELD_NAME_REGEX)
              ? 3
              : bName?.match(DEBUG_LEVEL_FIELD_NAME_REGEX)
              ? 2
              : bName?.match(INFO_LEVEL_FIELD_NAME_REGEX)
              ? 2
              : 1;

            return aVal - bVal;
          });
      })
    );
  };
}

export function getResourceQueryRunner(queries: LokiQuery[]) {
  return new SceneQueryRunner({
    datasource: { uid: WRAPPED_LOKI_DS_UID },
    queries: queries,
  });
}

export function getQueryRunner(queries: LokiQuery[], queryRunnerOptions?: Partial<QueryRunnerState>) {
  // if there's a legendFormat related to any `level` like label, we want to
  // sort the output equally. That's purposefully not `LEVEL_VARIABLE_VALUE`,
  // such that the `detected_level` graph looks the same as a graph for the
  // `level` label.

  const hasLevel = queries.find((query) => query.legendFormat?.toLowerCase().includes('level'));
  const isLogPanelQuery = queries.find(
    (query) => query.refId === LOGS_PANEL_QUERY_REFID || query.refId === LOGS_COUNT_QUERY_REFID
  );

  if (hasLevel) {
    return new SceneDataTransformer({
      $data: getSceneQueryRunner({
        datasource: { uid: WRAPPED_LOKI_DS_UID },
        queries: queries,
        ...queryRunnerOptions,
      }),
      transformations: [sortLevelTransformation],
    });
  }

  if (!isLogPanelQuery) {
    return new SceneDataTransformer({
      $data: getSceneQueryRunner({
        datasource: { uid: WRAPPED_LOKI_DS_UID },
        queries: queries,
        ...queryRunnerOptions,
      }),
      transformations: [setColorByDisplayNameTransformation],
    });
  } else {
    queries = queries.map((query) => ({
      ...query,
      get direction() {
        const sortOrder =
          getLogsPanelSortOrderFromURL() || getLogOption<LogsSortOrder>('sortOrder', LogsSortOrder.Descending);
        return sortOrder === LogsSortOrder.Descending ? LokiQueryDirection.Backward : LokiQueryDirection.Forward;
      },
    }));
  }

  return getSceneQueryRunner({
    datasource: { uid: WRAPPED_LOKI_DS_UID },
    queries: queries,
    ...queryRunnerOptions,
  });
}

export function getSceneQueryRunner(queryRunnerOptions?: Partial<QueryRunnerState>) {
  return new SceneQueryRunner({
    datasource: { uid: WRAPPED_LOKI_DS_UID },
    queries: [],
    ...queryRunnerOptions,
  });
}

export function getQueryRunnerFromProvider(provider: SceneDataProvider): SceneQueryRunner {
  if (provider instanceof SceneQueryRunner) {
    return provider;
  }

  if (provider.state.$data instanceof SceneQueryRunner) {
    return provider.state.$data;
  }

  throw new Error('SceneDataProvider is missing SceneQueryRunner');
}
export const logsControlsSupported =
  // @ts-expect-error Requires Grafana 12.1
  config.featureToggles.logsPanelControls &&
  (config.buildInfo.version > '12.1' || config.buildInfo.version.includes('12.1'));
