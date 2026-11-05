import { TimeRange } from '@grafana/data';

export type EmbeddedLogsMiniVisualizationType = 'logs' | 'table';

// Only consulted when visualizationType is 'logs'; the table view has no exposed options yet
// and always uses its own good defaults.
export interface EmbeddedLogsMiniLogsOptions {
  enableLogDetails?: boolean;
}

export interface EmbeddedLogsMiniProps {
  datasourceUid: string;
  embedderName: string;
  logsOptions?: EmbeddedLogsMiniLogsOptions;
  onTimeRangeChange?: (timeRange: TimeRange) => void;
  // Stream selector + optional log pipeline, e.g. `{service_name="foo"} |= "bar"`
  query: string;
  // Baseline query to compare `query` against, e.g. for anomaly/outlier detection
  referenceQuery?: string;
  // Defaults to true.
  showLogsVolume?: boolean;
  timeRange?: TimeRange;
  // Defaults to 'logs'.
  visualizationType?: EmbeddedLogsMiniVisualizationType;
}
