import React, { useEffect, useState } from 'react';
import { AdHocFilterWithLabels, SceneTimeRange } from '@grafana/scenes';

import { IndexScene } from 'Components/IndexScene/IndexScene';
import { EmbeddedLogsExplorationProps } from './types';
import { initializeMetadataService } from 'services/metadata';
import { getMatcherFromQuery } from 'services/logqlMatchers';

import initRuntimeDs from 'services/datasource';

export function buildLogsExplorationFromState({
  timeRangeState,
  onTimeRangeChange,
  query,
  ...state
}: EmbeddedLogsExplorationProps) {
  console.log('buildLogsExplorationFromState', { state, query, timeRangeState });
  const $timeRange = new SceneTimeRange(timeRangeState);
  $timeRange.subscribeToState((state) => {
    if (onTimeRangeChange) {
      onTimeRangeChange(state.value);
    }
  });

  if (!query) {
    return null;
  }

  initRuntimeDs();

  const { labelFilters } = getMatcherFromQuery(query);

  const initialLabels: AdHocFilterWithLabels[] = labelFilters.map((filter) => ({
    key: filter.key,
    value: filter.value,
    operator: filter.operator,
  }));

  return new IndexScene({
    ...state,
    initialFilters: initialLabels,
    $timeRange,
    embedded: true,
  });
}

export default function EmbeddedLogsExploration(props: EmbeddedLogsExplorationProps) {
  const [exploration, setExploration] = useState<IndexScene | null>(null);

  useEffect(() => {
    if (!exploration) {
      initializeMetadataService();
      setExploration(buildLogsExplorationFromState(props));
      console.log('setting exploration', exploration);
    }
  }, [exploration, props]);

  if (!exploration) {
    return null;
  }

  return <exploration.Component model={exploration} />;
}
