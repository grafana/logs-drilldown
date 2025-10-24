import { TimeRange } from '@grafana/data';

interface SceneTimeRangeStateStub {
  from: string;
  to: string;
  value: TimeRange;
}

interface MiniEmbeddedLogsCommonProps {
  embedderName: string;
  namespace?: string;
  onTimeRangeChange?: (timeRange: TimeRange) => void;
  query: string;
  referenceQuery?: string;
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

export type MiniEmbeddedLogsExplorationProps =
  | (EmbeddedLogsExplorationFromQuery & MiniEmbeddedLogsCommonProps)
  | (EmbeddedLogsExplorationTestingRoute & MiniEmbeddedLogsCommonProps);
