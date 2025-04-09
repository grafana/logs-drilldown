import { AppPluginMeta, rangeUtil, RelativeTimeRange, TimeOption } from '@grafana/data';
import { plugin } from '../module';
import { JsonData } from '../Components/AppConfig/AppConfig';

/**
 * Filters TimeOptions that are more than the configured max query duration.
 *
 * @todo ideally we could ask Loki what the maximum duration is,
 * but for now let's only show options that are less than the max duration configured for the Logs Drilldown app
 */
export const filterInvalidTimeOptions = (timeOptions: TimeOption[]) => {
  const { jsonData } = plugin.meta as AppPluginMeta<JsonData>;
  if (jsonData?.interval) {
    const maxSeconds = rangeUtil.intervalToSeconds(jsonData?.interval ?? '');

    if (maxSeconds) {
      return timeOptions.filter((timeOption) => {
        const timeRange = mapOptionToRelativeTimeRange(timeOption);
        const delta = timeRange.from - timeRange.to;

        // see https://github.com/grafana/grafana/issues/103480, mapOptionToRelativeTimeRange doesn't work with months or years
        return delta === 0 || delta <= maxSeconds;
      });
    }
  }

  return timeOptions;
};

// @todo export from core and delete the following: https://github.com/grafana/grafana/issues/103478
const regex = /^now$|^now(\-|\+)(\d{1,10})([wdhms])$/;

const units: Record<string, number> = {
  w: 604800,
  d: 86400,
  h: 3600,
  m: 60,
  s: 1,
};

export const mapOptionToRelativeTimeRange = (option: TimeOption): RelativeTimeRange => {
  return {
    from: relativeToSeconds(option.from),
    to: relativeToSeconds(option.to),
  };
};

const relativeToSeconds = (relative: string): number => {
  const match = regex.exec(relative);

  if (!match || match.length !== 4) {
    return 0;
  }

  const [, sign, value, unit] = match;
  const parsed = parseInt(value, 10);

  if (isNaN(parsed)) {
    return 0;
  }

  const seconds = parsed * units[unit];
  return sign === '+' ? seconds * -1 : seconds;
};

export const quickOptions: TimeOption[] = [
  { from: 'now-5m', to: 'now', display: 'Last 5 minutes' },
  { from: 'now-15m', to: 'now', display: 'Last 15 minutes' },
  { from: 'now-30m', to: 'now', display: 'Last 30 minutes' },
  { from: 'now-1h', to: 'now', display: 'Last 1 hour' },
  { from: 'now-3h', to: 'now', display: 'Last 3 hours' },
  { from: 'now-6h', to: 'now', display: 'Last 6 hours' },
  { from: 'now-12h', to: 'now', display: 'Last 12 hours' },
  { from: 'now-24h', to: 'now', display: 'Last 24 hours' },
  { from: 'now-2d', to: 'now', display: 'Last 2 days' },
  { from: 'now-7d', to: 'now', display: 'Last 7 days' },
  { from: 'now-30d', to: 'now', display: 'Last 30 days' },
  { from: 'now-60d', to: 'now', display: 'Last 60 days' },
  { from: 'now-90d', to: 'now', display: 'Last 90 days' },
  { from: 'now-1d/d', to: 'now-1d/d', display: 'Yesterday' },
  { from: 'now-2d/d', to: 'now-2d/d', display: 'Day before yesterday' },
  { from: 'now-7d/d', to: 'now-7d/d', display: 'This day last week' },
  { from: 'now-1w/w', to: 'now-1w/w', display: 'Previous week' },
  { from: 'now-1M/M', to: 'now-1M/M', display: 'Previous month' },
  { from: 'now-1Q/fQ', to: 'now-1Q/fQ', display: 'Previous fiscal quarter' },
  { from: 'now/d', to: 'now/d', display: 'Today' },
  { from: 'now/d', to: 'now', display: 'Today so far' },
  { from: 'now/w', to: 'now/w', display: 'This week' },
  { from: 'now/w', to: 'now', display: 'This week so far' },
  { from: 'now/M', to: 'now/M', display: 'This month' },
  { from: 'now/M', to: 'now', display: 'This month so far' },
];
