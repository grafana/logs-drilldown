import { DataFrame, FieldType, LoadingState } from '@grafana/data';
import { sceneGraph, SceneObject } from '@grafana/scenes';

import { getLevelLabelsFromSeries, getVisibleLevels } from './levels';
import { LogsVolumePanel } from 'Components/ServiceScene/LogsVolume/LogsVolumePanel';
import { getFeatureFlag } from 'featureFlags/openFeature';

export function isLogsVolumeByFieldEnabled(): boolean {
  return getFeatureFlag('drilldown.logs.logsVolumeByField');
}

function shouldFilterLogsVolumeByLevel(sceneRef: SceneObject): boolean {
  if (sceneRef instanceof LogsVolumePanel) {
    return sceneRef.isAggregatingByLevel();
  }
  return true;
}

/**
 * Sums volume samples. When grouped by detected_level, only series matching active level filters are included.
 */
export function sumLogsVolumeSeries(series: DataFrame[], sceneRef: SceneObject): number {
  const filterByLevel = shouldFilterLogsVolumeByLevel(sceneRef);
  const levelsByFrame = filterByLevel ? getLevelLabelsFromSeries(series) : [];
  const visibleLevels = filterByLevel ? new Set(getVisibleLevels(levelsByFrame, sceneRef)) : null;

  let total = 0;
  for (let i = 0; i < series.length; i++) {
    const frame = series[i];
    if (frame == null) {
      continue;
    }
    if (visibleLevels) {
      const level = levelsByFrame[i];
      if (level == null || !visibleLevels.has(level)) {
        continue;
      }
    }
    const valueField = frame.fields.find((field) => field.type === FieldType.number);
    if (!valueField) {
      continue;
    }
    for (const value of valueField.values) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        total += value;
      }
    }
  }
  return total;
}

/**
 * Reads distinct detected_level names from a completed logs volume (range) query.
 */
export function readLevelsFromCompletedLogsVolumePanel(volumePanel: LogsVolumePanel): string[] | null {
  if (!volumePanel.isAggregatingByLevel()) {
    return null;
  }
  const vizPanel = volumePanel.state.panel;
  if (!vizPanel || vizPanel.state.collapsed) {
    return null;
  }
  const queryData = vizPanel.state.$data?.state.data;
  if (queryData?.state !== LoadingState.Done || !queryData.series?.length) {
    return null;
  }
  return [...new Set(getLevelLabelsFromSeries(queryData.series))];
}

/**
 * When there are no other inclusive equal level filters in the pipeline, the levels dropdown
 * matches the logs volume chart scope (no level filters in the query). Reuse the volume
 * series instead of running another Loki query.
 */
export function getLevelsFromLogsVolume(
  sceneRef: SceneObject,
  otherPendingLevelFiltersPipeline: string
): string[] | null {
  if (otherPendingLevelFiltersPipeline.trim() !== '') {
    return null;
  }
  const volumePanel = sceneGraph.findObject(sceneRef, (o) => o instanceof LogsVolumePanel);
  if (!(volumePanel instanceof LogsVolumePanel)) {
    return null;
  }
  return readLevelsFromCompletedLogsVolumePanel(volumePanel);
}
