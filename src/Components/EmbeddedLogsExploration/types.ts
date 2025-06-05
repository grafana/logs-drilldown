import { AbstractLabelMatcher, TimeRange } from '@grafana/data';
import { SceneTimeRangeState } from '@grafana/scenes';

import { IndexSceneState } from 'Components/IndexScene/IndexScene';

interface EmbeddedLogsExplorationFromQuery extends IndexSceneState {
  datasourceUid?: string;
  onTimeRangeChange?: (timeRange: TimeRange) => void;
  query: string;
  streamSelectors?: never;
  timeRangeState: SceneTimeRangeState;
}

interface EmbeddedLogsExplorationFromFilters extends IndexSceneState {
  datasourceUid?: string;
  onTimeRangeChange: (timeRange: TimeRange) => void;
  query?: never;
  streamSelectors: AbstractLabelMatcher[];
  timeRangeState?: SceneTimeRangeState;
}

export type EmbeddedLogsExplorationProps = EmbeddedLogsExplorationFromQuery | EmbeddedLogsExplorationFromFilters;
