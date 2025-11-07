import { AppPluginMeta, rangeUtil, RelativeTimeRange, TimeOption } from '@grafana/data';

import { JsonData } from '../Components/AppConfig/AppConfig';
import { plugin } from '../module';
import { LokiConfig } from './datasourceTypes';

type FuzzyTimeOption = TimeOption & { fuzzySeconds: number };

/**
 * Filters TimeOptions that are more than the configured max query duration.
 *
 * @todo ideally we could ask Loki what the maximum duration is,
 * but for now let's only show options that are less than the max duration configured for the Logs Drilldown app
 */
export const filterInvalidTimeOptions = (timeOptions: FuzzyTimeOption[], lokiConfig?: LokiConfig) => {
  const { jsonData } = plugin.meta as AppPluginMeta<JsonData>;
  if (jsonData?.interval || lokiConfig?.limits.max_query_length || lokiConfig?.limits.retention_period) {
    let maxQueryLengthSeconds = 0,
      maxPluginConfigSeconds = 0,
      maxRetentionSeconds = 0;

    try {
      maxQueryLengthSeconds = rangeUtil.intervalToSeconds(lokiConfig?.limits.max_query_length ?? '');
    } catch (e) {}

    try {
      maxPluginConfigSeconds = rangeUtil.intervalToSeconds(jsonData?.interval ?? '');
    } catch (e) {}
    try {
      maxRetentionSeconds = rangeUtil.intervalToSeconds(lokiConfig?.limits.retention_period ?? '');
    } catch (e) {}

    if (maxPluginConfigSeconds || maxQueryLengthSeconds) {
      return timeOptions.filter((timeOption) => {
        const timeRange = mapOptionToRelativeTimeRange(timeOption);
        const delta = timeRange.from - timeRange.to || timeOption.fuzzySeconds;

        // see https://github.com/grafana/grafana/issues/103480, mapOptionToRelativeTimeRange doesn't work with months or years
        return delta === 0 || delta <= (maxQueryLengthSeconds || maxRetentionSeconds || maxPluginConfigSeconds);
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
// @todo get rid of this, pre-calc is same accuracy
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

export const quickOptions: FuzzyTimeOption[] = [
  { from: 'now-5m', to: 'now', display: 'Last 5 minutes', fuzzySeconds: units.m * 5 },
  { from: 'now-15m', to: 'now', display: 'Last 15 minutes', fuzzySeconds: units.m * 15 },
  { from: 'now-30m', to: 'now', display: 'Last 30 minutes', fuzzySeconds: units.m * 30 },
  { from: 'now-1h', to: 'now', display: 'Last 1 hour', fuzzySeconds: units.h },
  { from: 'now-3h', to: 'now', display: 'Last 3 hours', fuzzySeconds: units.h * 3 },
  { from: 'now-6h', to: 'now', display: 'Last 6 hours', fuzzySeconds: units.h * 6 },
  { from: 'now-12h', to: 'now', display: 'Last 12 hours', fuzzySeconds: units.h * 12 },
  { from: 'now-24h', to: 'now', display: 'Last 24 hours', fuzzySeconds: units.h * 24 },
  { from: 'now-2d', to: 'now', display: 'Last 2 days', fuzzySeconds: units.d * 2 },
  { from: 'now-7d', to: 'now', display: 'Last 7 days', fuzzySeconds: units.d * 7 },
  { from: 'now-30d', to: 'now', display: 'Last 30 days', fuzzySeconds: units.d * 30 },
  { from: 'now-60d', to: 'now', display: 'Last 60 days', fuzzySeconds: units.d * 60 },
  { from: 'now-90d', to: 'now', display: 'Last 90 days', fuzzySeconds: units.d * 90 },
  { from: 'now-1d/d', to: 'now-1d/d', display: 'Yesterday', fuzzySeconds: units.d },
  { from: 'now-2d/d', to: 'now-2d/d', display: 'Day before yesterday', fuzzySeconds: units.d },
  { from: 'now-7d/d', to: 'now-7d/d', display: 'This day last week', fuzzySeconds: units.d },
  { from: 'now-1w/w', to: 'now-1w/w', display: 'Previous week', fuzzySeconds: units.d * 7 },
  { from: 'now-1M/M', to: 'now-1M/M', display: 'Previous month', fuzzySeconds: units.d * 28 },
  { from: 'now-1Q/fQ', to: 'now-1Q/fQ', display: 'Previous fiscal quarter', fuzzySeconds: (units.d * 365) / 4 },
  { from: 'now/d', to: 'now/d', display: 'Today', fuzzySeconds: units.d },
  { from: 'now/d', to: 'now', display: 'Today so far', fuzzySeconds: units.d },
  { from: 'now/w', to: 'now/w', display: 'This week', fuzzySeconds: units.d * 7 },
  { from: 'now/w', to: 'now', display: 'This week so far', fuzzySeconds: units.d * 7 },
  { from: 'now/M', to: 'now/M', display: 'This month', fuzzySeconds: units.d * 28 },
  { from: 'now/M', to: 'now', display: 'This month so far', fuzzySeconds: units.d * 28 },
];
