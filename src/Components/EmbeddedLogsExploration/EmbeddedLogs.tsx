import React, { useState } from 'react';
import { SceneTimeRange } from '@grafana/scenes';

import { IndexScene } from 'Components/IndexScene/IndexScene';
import { EmbeddedLogsExplorationState } from './types';

function buildTraceExplorationFromState({ timeRangeState, onTimeRangeChange, ...state }: EmbeddedLogsExplorationState) {
  const $timeRange = new SceneTimeRange(timeRangeState);
  $timeRange.subscribeToState((state) => {
    if (onTimeRangeChange) {
      onTimeRangeChange(state.value);
    }
  });

  return new IndexScene({
    $timeRange,
    embedded: true,
    ...state,
  });
}

export default function EmbeddedTraceExploration(props: EmbeddedLogsExplorationState) {
  const [exploration] = useState(buildTraceExplorationFromState(props));

  return <exploration.Component model={exploration} />;
}
