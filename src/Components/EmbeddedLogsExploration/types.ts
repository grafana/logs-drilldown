import { TimeRange } from '@grafana/data';

interface SceneTimeRangeStateStub {
  from: string;
  to: string;
  value: TimeRange;
}

interface EmbeddedLogsCommonProps {
  embedderName: string;
  onTimeRangeChange?: (timeRange: TimeRange) => void;
  query: string;
  timeRangeState: SceneTimeRangeStateStub;
}

// Datasource ID is required when embedded in another application
interface EmbeddedLogsExplorationFromQuery {
  datasourceUid: string;
}

// But not required when testing, as we expect the datasource id to get pulled from the URL instead
interface EmbeddedLogsExplorationTestingRoute {
  datasourceUid?: string;
}

export type EmbeddedLogsExplorationProps =
  | (EmbeddedLogsExplorationFromQuery & EmbeddedLogsCommonProps)
  | (EmbeddedLogsExplorationTestingRoute & EmbeddedLogsCommonProps);
