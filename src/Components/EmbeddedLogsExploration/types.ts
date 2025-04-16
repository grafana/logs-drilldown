import { AbstractLabelMatcher, TimeRange } from '@grafana/data';
import { SceneTimeRangeState } from '@grafana/scenes';
import { IndexSceneState } from 'Components/IndexScene/IndexScene';

interface EmbeddedLogsExplorationFromQuery extends IndexSceneState {
  datasourceUid: string;
  streamSelectors?: never;
  query: string;
  timeRangeState: SceneTimeRangeState;
  onTimeRangeChange: (timeRange: TimeRange) => void;
  onQueryChange: (query: string) => void;
}

interface EmbeddedLogsExplorationFromFilters extends IndexSceneState {
  datasourceUid: string;
  streamSelectors: AbstractLabelMatcher[];
  query?: never;
  timeRangeState: SceneTimeRangeState;
  onTimeRangeChange: (timeRange: TimeRange) => void;
  onQueryChange: (query: string) => void;
}

export type EmbeddedLogsExplorationProps = EmbeddedLogsExplorationFromQuery | EmbeddedLogsExplorationFromFilters;
