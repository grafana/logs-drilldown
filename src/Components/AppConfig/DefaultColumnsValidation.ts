import { LOG_LINE_BODY_FIELD_NAME } from '../ServiceScene/LogOptionsScene';
import { LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecord } from './types';

export const isRecordLabelsValid = (r: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecord) => {
  return r.labels.every((l) => l.key !== '' && l.value !== undefined);
};
export const recordColumnsHaveValues = (r: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecord) =>
  r.columns.every((c) => c);
export const recordColumnsAreNotLogLine = (r: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecord) =>
  !(r.columns.length === 1 && r.columns[0] === LOG_LINE_BODY_FIELD_NAME);

export const isRecordColumnsValid = (r: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecord) => {
  return recordColumnsHaveValues(r) && recordColumnsAreNotLogLine(r);
};
export const isRecordInvalid = (r: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecord) => {
  return !(r.columns.length && r.labels.length && isRecordLabelsValid(r) && isRecordColumnsValid(r));
};
