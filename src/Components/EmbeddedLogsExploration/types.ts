import { AbstractLabelMatcher, TimeRange } from '@grafana/data';
import { SceneTimeRangeState } from '@grafana/scenes';
import { IndexSceneState } from 'Components/IndexScene/IndexScene';

interface EmbeddedLogsExplorationFromQuery extends IndexSceneState {
  datasourceUid: string;
  streamSelectors?: never;
  query: string;
  timeRangeState: SceneTimeRangeState;
  onTimeRangeChange: (timeRange: TimeRange) => void;
}

interface EmbeddedLogsExplorationFromFilters extends IndexSceneState {
  datasourceUid: string;
  streamSelectors: AbstractLabelMatcher[];
  query?: never;
  timeRangeState: SceneTimeRangeState;
  onTimeRangeChange: (timeRange: TimeRange) => void;
}

export type EmbeddedLogsExplorationProps = EmbeddedLogsExplorationFromQuery | EmbeddedLogsExplorationFromFilters;
