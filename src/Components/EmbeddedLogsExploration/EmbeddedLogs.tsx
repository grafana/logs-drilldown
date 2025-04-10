import React, { useEffect, useState } from 'react';
import { SceneTimeRange } from '@grafana/scenes';

import { IndexScene } from 'Components/IndexScene/IndexScene';
import { EmbeddedLogsExplorationProps } from './types';
import { initializeMetadataService } from 'services/metadata';
import { getMatcherFromQuery } from 'services/logqlMatchers';

function buildLogsExplorationFromState({
  timeRangeState,
  onTimeRangeChange,
  query,
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

  const { labelFilters } = getMatcherFromQuery(query);

  return new IndexScene({
    ...state,
    $timeRange,
    initialFilters: labelFilters,
    embedded: true,
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
