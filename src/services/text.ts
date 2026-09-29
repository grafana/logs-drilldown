import { DataFrame, dateTime, LogRowModel, LogsSortOrder, TimeRange, urlUtil } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';

import {
  setLineFilterUrlParams,
  setUrlParamsFromFieldFilters,
  setUrlParamsFromLabelFilters,
  UrlParameters,
} from './extensions/links';
import { LabelType } from './fieldsTypes';
import { FieldFilter, FilterOp, IndexedLabelFilter, LineFilterType } from './filterTypes';
import { logger } from './logger';
import { parseLogsFrame } from './logsFrame';
import { getLabelTypeFromFrame } from './lokiQuery';
import { LEVEL_VARIABLE_VALUE } from './variables';

/**
 * Copies text synchronously. If not executed in the same call stack as the user event this will fail in Safari!
 * @param string
 */
export const copyText = (string: string) => {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(string);
  } else {
    const el = document.createElement('textarea');
    el.value = string;
    document.body.appendChild(el);
    el.select();
    /* eslint-disable-next-line @typescript-eslint/no-deprecated -- execCommand is the standard pre-Clipboard fallback */
    document.execCommand('copy');
    document.body.removeChild(el);
  }
};

export enum UrlParameterType {
  From = 'from',
  To = 'to',
}

type PermalinkDataType =
  | {
      id?: string;
      row?: number;
    }
  | {
      logs: {
        displayedFields: string[];
        id: string;
        sortOrder: LogsSortOrder;
      };
    };

/**
 * The minimal subset of {@link LogRowModel} required to build a permalink to a log line.
 * A full `LogRowModel` (as provided by the native logs panel) satisfies this type, but it can
 * also be constructed from a raw data frame row via {@link getPermalinkLogRowFromDataFrame},
 * which is what the Table and JSON visualizations use.
 */
export type PermalinkLogRow = Pick<LogRowModel, 'dataFrame' | 'labels' | 'rowIndex' | 'timeEpochMs' | 'uniqueLabels'> &
  Partial<Pick<LogRowModel, 'timeEpochNs'>>;

export const generateLink = (relativeUrl: string): string => {
  return `${window.location.protocol}//${window.location.host}${config.appSubUrl}${relativeUrl}`;
};

export const generateLogShortlink = (paramName: string, data: PermalinkDataType, timeRange: TimeRange) => {
  const location = locationService.getLocation();
  const searchParams = urlUtil.getUrlSearchParams();
  searchParams[UrlParameterType.From] = timeRange.from.toISOString();
  searchParams[UrlParameterType.To] = timeRange.to.toISOString();
  searchParams[paramName] = JSON.stringify(data);
  return generateLink(urlUtil.renderUrl(location.pathname, searchParams));
};

export const generateLogRowShortlink = (
  log: PermalinkLogRow,
  panelState?: PermalinkDataType,
  paramName = 'panelState',
  sortOrder = panelState && 'logs' in panelState ? panelState.logs.sortOrder : LogsSortOrder.Descending
) => {
  const location = locationService.getLocation();
  const timeRange = resolveRowTimeRangeForSharing(log);
  let searchParams = new URLSearchParams(location.search);
  searchParams.set(paramName, JSON.stringify(panelState));
  searchParams.delete('startNs');
  searchParams.delete('endNs');
  if (log.timeEpochNs) {
    const forward = sortOrder === LogsSortOrder.Ascending;
    const endNs = BigInt(log.timeEpochNs) + BigInt(1);
    // Loki parses bounds as signed int64; its exclusive end must still be representable.
    const maxInt64Ns = BigInt('9223372036854775807');
    if (forward || endNs <= maxInt64Ns) {
      searchParams.set('sortOrder', JSON.stringify(sortOrder));
      searchParams.set(forward ? 'startNs' : 'endNs', forward ? log.timeEpochNs : endNs.toString());
      timeRange.from = dateTime(forward ? log.timeEpochMs : log.timeEpochMs - MIN_SHARE_RANGE_MS);
      timeRange.to = dateTime(forward ? log.timeEpochMs + MIN_SHARE_RANGE_MS : log.timeEpochMs + 1);
      timeRange.raw = { from: timeRange.from, to: timeRange.to };
    }
  }
  const { fields } = getLogLinePermalinkFilterParams(log);
  return generateLinkFromFilters(`${location.pathname}?${searchParams.toString()}`, { fields, labels: [] }, timeRange);
};

/**
 * Builds a {@link PermalinkLogRow} from a raw logs data frame and a row index. Used by the Table and
 * JSON visualizations, which work with data frames rather than `LogRowModel`s, to produce permalinks
 * via {@link generateLogRowShortlink}.
 */
export function getPermalinkLogRowFromDataFrame(dataFrame: DataFrame, rowIndex: number): PermalinkLogRow | null {
  const logsFrame = parseLogsFrame(dataFrame);
  if (!logsFrame) {
    return null;
  }

  const timeEpochMs = Number(logsFrame.timeField.values[rowIndex]);
  if (!Number.isFinite(timeEpochMs)) {
    return null;
  }

  // Use the row's full label set for both `labels` and `uniqueLabels`: `getLogLinePermalinkFilterParams`
  // reads the level from `labels` and derives field filters from `uniqueLabels`, skipping indexed labels.
  const labels = logsFrame.getLogFrameLabelsAsLabels()?.[rowIndex] ?? {};
  const nanoseconds = logsFrame.timeField.nanos?.[rowIndex];
  const timeEpochNs =
    logsFrame.timeNanosecondField?.values[rowIndex] ??
    (nanoseconds !== undefined
      ? (BigInt(Math.floor(timeEpochMs)) * BigInt(1000000) + BigInt(nanoseconds)).toString()
      : undefined);

  return {
    dataFrame,
    labels,
    rowIndex,
    timeEpochMs,
    timeEpochNs,
    uniqueLabels: labels,
  };
}

export type LinkFilters = {
  fields?: FieldFilter[];
  labels: IndexedLabelFilter[];
  lineFilters?: LineFilterType[];
};

export const generateLinkFromFilters = (path: string, filters: LinkFilters, timeRange?: TimeRange) => {
  const url = new URL(generateLink(path));

  let searchParams = url.searchParams;
  if (timeRange) {
    searchParams.set(UrlParameterType.From, timeRange.from.toISOString());
    searchParams.set(UrlParameterType.To, timeRange.to.toISOString());
  }

  const { fields = [], labels, lineFilters = [] } = filters;

  if (labels.length) {
    searchParams.delete(UrlParameters.Labels);
    searchParams = setUrlParamsFromLabelFilters(labels, searchParams);
  }

  if (lineFilters.length) {
    searchParams.delete(UrlParameters.LineFilters);
    searchParams = setLineFilterUrlParams(lineFilters, searchParams);
  }

  if (fields.length) {
    searchParams.delete(UrlParameters.Fields);
    searchParams.delete(UrlParameters.Levels);
    searchParams.delete(UrlParameters.Metadata);
    searchParams = setUrlParamsFromFieldFilters(fields, searchParams);
  }

  return `${url.origin}${url.pathname}?${searchParams.toString()}`;
};

const OMIT_UNIQUE_LABELS = [
  '__aggregated_metric__',
  '__stream_shard__',
  '__adaptive_logs_sampled__',
  LEVEL_VARIABLE_VALUE,
  'level',
  'level_extracted',
];
/**
 * Given a particular log, generate the necessary filters to narrow down the search as much as possible.
 */
export function getLogLinePermalinkFilterParams(log: PermalinkLogRow) {
  const labels: IndexedLabelFilter[] = [];
  const fields: FieldFilter[] = [];

  if (log.labels[LEVEL_VARIABLE_VALUE]) {
    fields.push({
      key: LEVEL_VARIABLE_VALUE,
      operator: FilterOp.Equal,
      type: getLabelTypeFromFrame(LEVEL_VARIABLE_VALUE, log.dataFrame, log.rowIndex) ?? LabelType.Parsed,
      value: log.labels[LEVEL_VARIABLE_VALUE],
    });
  }

  for (const label in log.uniqueLabels) {
    if (OMIT_UNIQUE_LABELS.includes(label)) {
      continue;
    }
    const labelType = getLabelTypeFromFrame(label, log.dataFrame, log.rowIndex) ?? LabelType.Parsed;

    // Limit parsed fields to not overcrowd the filters with superfluous entries.
    const hasParsedFields = fields.filter((field) => field.type === LabelType.Parsed).length === 2;

    if (labelType === LabelType.Indexed) {
      labels.push({
        key: label,
        operator: FilterOp.Equal,
        type: LabelType.Indexed,
        value: log.uniqueLabels[label],
      });
    } else if (labelType === LabelType.StructuredMetadata || !hasParsedFields) {
      fields.push({
        key: label,
        operator: FilterOp.Equal,
        type: labelType,
        parser: labelType === LabelType.StructuredMetadata ? 'structuredMetadata' : 'mixed',
        value: log.uniqueLabels[label],
      });
    }
  }

  return {
    fields,
    labels,
  };
}

/** Ensures end > start so downstream (e.g. Tempo trace lookup) never gets "end timestamp must not be before or equal to start time". */
export function ensureValidTimeRangeForLink(fromMs: number, toMs: number): [number, number] {
  const minDurationMs = 1000;
  if (toMs <= fromMs) {
    return [fromMs, fromMs + minDurationMs];
  }
  return [fromMs, toMs];
}

export function capitalizeFirstLetter(input: string) {
  if (input.length) {
    return input?.charAt(0).toUpperCase() + input.slice(1);
  }

  logger.warn('invalid string argument');
  return input;
}

export function truncateText(input: string, length: number, ellipsis: boolean) {
  return input.substring(0, length) + (ellipsis && input.length > length ? '…' : '');
}

/** Minimum duration in ms so trace lookups (e.g. from Loki derived field) always get start < end. */
const MIN_SHARE_RANGE_MS = 1000;

export function resolveRowTimeRangeForSharing(row: Pick<LogRowModel, 'timeEpochMs'>): TimeRange {
  // With infinite scrolling, we cannot rely on the time picker range, so we use a time range around the shared log line.
  // Ensure end > start (Tempo returns "end timestamp must not be before or equal to start time" otherwise).
  const half = Math.max(MIN_SHARE_RANGE_MS / 2, 1);
  const from = dateTime(row.timeEpochMs - half);
  const to = dateTime(row.timeEpochMs + half);

  const range = {
    from,
    raw: {
      from,
      to,
    },
    to,
  };

  return range;
}
