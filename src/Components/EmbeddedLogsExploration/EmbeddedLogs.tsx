import React, { useEffect, useState } from 'react';

import { AdHocFilterWithLabels, SceneTimeRange } from '@grafana/scenes';

import { EmbeddedLogsExplorationProps } from './types';
import { IndexScene } from 'Components/IndexScene/IndexScene';
import initRuntimeDs from 'services/datasource';
import { getMatcherFromQuery } from 'services/logqlMatchers';
import { initializeMetadataService } from 'services/metadata';

function buildLogsExplorationFromState({
  onTimeRangeChange,
  query,
  timeRangeState,
  ...state
}: EmbeddedLogsExplorationProps) {
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
    operator: filter.operator,
    value: filter.value,
  }));

  return new IndexScene({
    ...state,
    $timeRange,
    embedded: true,
    initialFilters: initialLabels,
  });
}

export default function EmbeddedLogsExploration(props: EmbeddedLogsExplorationProps) {
  const [exploration, setExploration] = useState<IndexScene | null>(null);

  useEffect(() => {
    if (!exploration) {
      initializeMetadataService();
      setExploration(buildLogsExplorationFromState(props));
    }
  }, [exploration, props]);

  if (!exploration) {
    return null;
  }

  return <exploration.Component model={exploration} />;
}
