import { dateTime, LogRowModel, LogsSortOrder, TimeRange, urlUtil } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';

import { logger } from './logger';

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
