import type { TimeRange } from '@grafana/data';

export interface PatternsProps {
  datasourceUid: string;
  onTimeRangeChange?: (timeRange: TimeRange) => void;
  query: string;
  timeRange: TimeRange;
}
