import { LogsDrilldownDefaultColumnsSpec } from '../../lib/api-clients/logsdrilldown/v1alpha1';

type dsUID = string;
export type DefaultColumnsState = Record<dsUID, LocalLogsDrilldownDefaultColumnsSpec>;
export type APIColumnsState = Record<dsUID, LogsDrilldownDefaultColumnsSpec>;

// @todo use existing types but make value optional
export type LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsLabel = {
  key: string;
  value?: string;
};
export type LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsLabels =
  LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsLabel[];
export type LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecord = {
  columns: string[];
  labels: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsLabels;
};
export type LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecords =
  LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecord[];
export type LocalLogsDrilldownDefaultColumnsSpec = {
  records: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecords;
};
export type LocalDefaultColumnsState = Record<dsUID, LocalLogsDrilldownDefaultColumnsSpec | undefined>;
