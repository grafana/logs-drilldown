import { dateTime, LogRowModel, LogsSortOrder, TimeRange, urlUtil } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';

import { setLineFilterUrlParams, setUrlParamsFromFieldFilters, setUrlParamsFromLabelFilters } from './extensions/links';
import { LabelType } from './fieldsTypes';
import { FieldFilter, FilterOp, IndexedLabelFilter, LineFilterType } from './filterTypes';
import { logger } from './logger';
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

export const generateLogRowShortlink = (log: LogRowModel, panelState?: PermalinkDataType) => {
  const location = locationService.getLocation();
  console.log(location);
  return;
  const timeRange = resolveRowTimeRangeForSharing(log);
  let searchParams = new URLSearchParams(location.search);
  searchParams.set('panelState', JSON.stringify(panelState));
  const { fields } = getLogLinePermalinkFilterParams(log);
  return generateLinkFromFilters(location.pathname, timeRange, searchParams, { fields, labels: [] });
};

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
    searchParams = setUrlParamsFromLabelFilters(labels, searchParams);
  }

  if (lineFilters.length) {
    searchParams = setLineFilterUrlParams(lineFilters, searchParams);
  }

  if (fields.length) {
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
export function getLogLinePermalinkFilterParams(log: LogRowModel) {
  const labels: IndexedLabelFilter[] = [];
  const fields: FieldFilter[] = [];

  if (log.labels[LEVEL_VARIABLE_VALUE]) {
    fields.push({
      key: LEVEL_VARIABLE_VALUE,
      operator: FilterOp.Equal,
      type: getLabelTypeFromFrame(LEVEL_VARIABLE_VALUE, log.dataFrame) ?? LabelType.Parsed,
      value: log.labels[LEVEL_VARIABLE_VALUE],
    });
  }

  for (const label in log.uniqueLabels) {
    if (OMIT_UNIQUE_LABELS.includes(label)) {
      continue;
    }
    const labelType = getLabelTypeFromFrame(label, log.dataFrame) ?? LabelType.Parsed;

    if (labelType === LabelType.Indexed) {
      labels.push({
        key: label,
        operator: FilterOp.Equal,
        type: LabelType.Indexed,
        value: log.uniqueLabels[label],
      });
    } else {
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

/**
 * Given a particular log, return the minimum set of filters to browse this and similar log lines.
 */
export function getLogLineFilterParams(log: LogRowModel) {
  const { fields, labels } = getLogLinePermalinkFilterParams(log);

  // If structured metadata fields are available, filter parsed fields to reduce noise.
  const hasStructuredMetadata = fields.some((field) => field.type === LabelType.StructuredMetadata);
  const filteredFields = hasStructuredMetadata
    ? fields.filter((field) => field.type === LabelType.StructuredMetadata)
    : fields;

  return {
    labels,
    fields: filteredFields,
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

export function resolveRowTimeRangeForSharing(row: LogRowModel): TimeRange {
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
