import { TimeRange } from '@grafana/data';

export interface EmbeddedQueryEfficiencyProps {
  datasourceUid: string;
  embedderName: string;
  onTimeRangeChange?: (timeRange: TimeRange) => void;
  // Stream selector + optional log pipeline, e.g. `{service_name="foo"} |= "bar"`
  query: string;
  timeRange?: TimeRange;
}
