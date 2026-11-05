import { TimeRange } from '@grafana/data';

export interface EmbeddedLogsMiniProps {
  datasourceUid: string;
  embedderName: string;
  onTimeRangeChange?: (timeRange: TimeRange) => void;
  // Stream selector + optional log pipeline, e.g. `{service_name="foo"} |= "bar"`
  query: string;
  timeRange: TimeRange;
}
