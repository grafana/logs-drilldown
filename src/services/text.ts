import { dateTime, LogRowModel, TimeRange, urlUtil } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';

import { logger } from './logger';

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

export function resolveRowTimeRangeForSharing(row: LogRowModel): TimeRange {
  // With infinite scrolling, we cannot rely on the time picker range, so we use a time range around the shared log line.
  const from = dateTime(row.timeEpochMs - 1);
  const to = dateTime(row.timeEpochMs + 1);

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
