import { TimeRange } from '@grafana/data';
import { SceneTimeRangeState } from '@grafana/scenes';

import { IndexSceneState } from 'Components/IndexScene/IndexScene';

interface EmbeddedLogsCommonProps extends IndexSceneState {
  onTimeRangeChange?: (timeRange: TimeRange) => void;
  query: string;
  timeRangeState: SceneTimeRangeState;
}

// Datasource ID is required when embedded in another application
interface EmbeddedLogsExplorationFromQuery extends IndexSceneState {
  datasourceUid: string;
}

// But not required when testing, as we expect the datasource id to get pulled from the URL instead
interface EmbeddedLogsExplorationTestingRoute extends IndexSceneState {
  datasourceUid?: string;
}

export type EmbeddedLogsExplorationProps =
  | (EmbeddedLogsExplorationFromQuery & EmbeddedLogsCommonProps)
  | (EmbeddedLogsExplorationTestingRoute & EmbeddedLogsCommonProps);
