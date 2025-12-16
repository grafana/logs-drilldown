import { TimeRange } from '@grafana/data';

interface SceneTimeRangeStateStub {
  from: string;
  to: string;
  value: TimeRange;
}

export interface EmptyStateOptions {
  customPrompt?: string;
  promptCTA?: string;
}

type EmptyStateConfig = {
  fields?: EmptyStateOptions;
  labels?: EmptyStateOptions;
  logs?: EmptyStateOptions;
};

export interface EmbeddedLogsOptions {
  emptyStates: EmptyStateConfig;
}

interface EmbeddedLogsCommonProps {
  embedderName: string;
  hideTimePicker?: boolean;
  namespace?: string;
  onTimeRangeChange?: (timeRange: TimeRange) => void;
  options?: EmbeddedLogsOptions;
  // Only labels are currently supported
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

export type EmbeddedLogsExplorationProps =
  | (EmbeddedLogsExplorationFromQuery & EmbeddedLogsCommonProps)
  | (EmbeddedLogsExplorationTestingRoute & EmbeddedLogsCommonProps);
