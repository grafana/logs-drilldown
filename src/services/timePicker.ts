import { AppPluginMeta, dateMath, getTimeZone, rangeUtil, TimeOption } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';

import { plugin } from '../module';
import { LokiConfig } from './datasourceTypes';
import { logger } from './logger';
import { parsePrometheusDuration } from './parsePrometheusDuration';
import { JsonData } from 'Components/AppConfig/AppConfig';

/**
 * Filters TimeOptions that are more than the max query duration, the retention period, or duration defined in plugin admin config
 * Loki config will override admin config
 */
export const filterInvalidTimeOptions = (timeOptions: TimeOption[], lokiConfig?: LokiConfig) => {
  const { jsonData } = plugin.meta as AppPluginMeta<JsonData>;
  if (jsonData?.interval || lokiConfig?.limits.retention_period) {
    let maxPluginConfigSeconds = 0,
      maxRetentionSeconds = 0;

    if (jsonData?.interval) {
      try {
        maxPluginConfigSeconds = Math.floor(parsePrometheusDuration(jsonData.interval) / 1000);
      } catch (e) {
        logger.error(e, { msg: `${jsonData.interval} is not a valid interval string!` });
      }
    }

    if (lokiConfig?.limits.retention_period) {
      try {
        maxRetentionSeconds = Math.floor(parsePrometheusDuration(lokiConfig?.limits.retention_period) / 1000);
      } catch (e) {
        logger.error(e, { msg: `${lokiConfig?.limits.retention_period} is not a valid interval string!` });
      }
    }

    if (maxPluginConfigSeconds || maxRetentionSeconds) {
      const timeZone = getTimeZone();
      return timeOptions.filter((timeOption) => {
        const timeRange = rangeUtil.convertRawToRange(timeOption, timeZone);
        if (timeRange) {
          // This will return the exact duration for the interval, if the interval covers DST there will be an extra/missing hour!
          const intervalSeconds = Math.floor((timeRange.to.valueOf() - timeRange.from.valueOf()) / 1000);
          // Pad retention by 10%, there's no downside to querying over retention besides some empty space in the query, and it might be frustrating to not get a time range if retention is close
          const retentionGreaterThanInterval = intervalSeconds <= maxRetentionSeconds * 1.1;
          const pluginConfigGreaterThanInterval = intervalSeconds <= maxPluginConfigSeconds;
          return intervalSeconds === 0 || retentionGreaterThanInterval || pluginConfigGreaterThanInterval;
        }

        return false;
      });
    }
  }

  return timeOptions;
};

const isSameRange = (a: Pick<TimeOption, 'from' | 'to'>, b: Pick<TimeOption, 'from' | 'to'>) =>
  a.from === b.from && a.to === b.to;

const isValidQuickRange = (option: TimeOption) =>
  Boolean(option?.from && option?.to && option.display && dateMath.isValid(option.from) && dateMath.isValid(option.to));

// Plugin config default time range goes first, then Grafana's `[time_picker] quick_ranges`, else the built-ins
export const getQuickRanges = (): TimeOption[] => {
  const serverRanges = Array.isArray(config.quickRanges) ? config.quickRanges.filter(isValidQuickRange) : [];
  if (!serverRanges.length) {
    return getQuickOptions();
  }

  const { jsonData } = plugin.meta as AppPluginMeta<JsonData>;
  const defaultRange = jsonData?.defaultTimeRange;
  if (!defaultRange?.from || !defaultRange?.to || serverRanges.some((r) => isSameRange(r, defaultRange))) {
    return serverRanges;
  }

  const display = rangeUtil.describeTimeRange({ from: defaultRange.from, to: defaultRange.to }, getTimeZone());
  return [{ from: defaultRange.from, to: defaultRange.to, display }, ...serverRanges];
};

// Taken from grafana-ui/src/components/DateTimePickers/options.ts and adapted for typical logs searches and retentions
export const getQuickOptions = (): TimeOption[] => [
  {
    from: 'now-1m',
    to: 'now',
    display: t('services.grafana-ui.date-time-pickers.quick-options.last-1-mins', 'Last minute'),
  },
  {
    from: 'now-5m',
    to: 'now',
    display: t('services.grafana-ui.date-time-pickers.quick-options.last-5-mins', 'Last 5 minutes'),
  },
  {
    from: 'now-15m',
    to: 'now',
    display: t('services.grafana-ui.date-time-pickers.quick-options.last-15-mins', 'Last 15 minutes'),
  },
  {
    from: 'now-30m',
    to: 'now',
    display: t('services.grafana-ui.date-time-pickers.quick-options.last-30-mins', 'Last 30 minutes'),
  },
  {
    from: 'now-1h',
    to: 'now',
    display: t('services.grafana-ui.date-time-pickers.quick-options.last-1-hour', 'Last 1 hour'),
  },
  {
    from: 'now-3h',
    to: 'now',
    display: t('services.grafana-ui.date-time-pickers.quick-options.last-3-hours', 'Last 3 hours'),
  },
  {
    from: 'now-6h',
    to: 'now',
    display: t('services.grafana-ui.date-time-pickers.quick-options.last-6-hours', 'Last 6 hours'),
  },
  {
    from: 'now-12h',
    to: 'now',
    display: t('services.grafana-ui.date-time-pickers.quick-options.last-12-hours', 'Last 12 hours'),
  },
  {
    from: 'now-24h',
    to: 'now',
    display: t('services.grafana-ui.date-time-pickers.quick-options.last-24-hours', 'Last 24 hours'),
  },
  {
    from: 'now-2d',
    to: 'now',
    display: t('services.grafana-ui.date-time-pickers.quick-options.last-2-days', 'Last 2 days'),
  },
  {
    from: 'now-7d',
    to: 'now',
    display: t('services.grafana-ui.date-time-pickers.quick-options.last-7-days', 'Last 7 days'),
  },
  {
    from: 'now-30d',
    to: 'now',
    display: t('services.grafana-ui.date-time-pickers.quick-options.last-30-days', 'Last 30 days'),
  },
  {
    from: 'now-60d',
    to: 'now',
    display: t('services.grafana-ui.date-time-pickers.quick-options.last-60-days', 'Last 60 days'),
  },
  {
    from: 'now-90d',
    to: 'now',
    display: t('services.grafana-ui.date-time-pickers.quick-options.last-90-days', 'Last 90 days'),
  },
  {
    from: 'now-6M',
    to: 'now',
    display: t('services.grafana-ui.date-time-pickers.quick-options.last-6-months', 'Last 6 months'),
  },
  {
    from: 'now-1d/d',
    to: 'now-1d/d',
    display: t('services.grafana-ui.date-time-pickers.quick-options.yesterday', 'Yesterday'),
  },
  {
    from: 'now-2d/d',
    to: 'now-2d/d',
    display: t('services.grafana-ui.date-time-pickers.quick-options.day-before-yesterday', 'Day before yesterday'),
  },
  {
    from: 'now-3d/d',
    to: 'now-3d/d',
    display: t('services.grafana-ui.date-time-pickers.quick-options.day-three-days-ago', 'Three days ago'),
  },
  {
    from: 'now-4d/d',
    to: 'now-4d/d',
    display: t('services.grafana-ui.date-time-pickers.quick-options.day-four-days-ago', 'Four days ago'),
  },
  {
    from: 'now-5d/d',
    to: 'now-5d/d',
    display: t('services.grafana-ui.date-time-pickers.quick-options.day-five-days-ago', 'Five days ago'),
  },
  {
    from: 'now-6d/d',
    to: 'now-6d/d',
    display: t('services.grafana-ui.date-time-pickers.quick-options.day-six-days-ago', 'Six days ago'),
  },
  {
    from: 'now-7d/d',
    to: 'now-7d/d',
    display: t('services.grafana-ui.date-time-pickers.quick-options.this-day-last-week', 'This day last week'),
  },
  {
    from: 'now-1w/w',
    to: 'now-1w/w',
    display: t('services.grafana-ui.date-time-pickers.quick-options.previous-week', 'Previous week'),
  },
  {
    from: 'now-2w/w',
    to: 'now-2w/w',
    display: t('services.grafana-ui.date-time-pickers.quick-options.two-weeks-ago', 'Two weeks ago'),
  },
  {
    from: 'now-3w/w',
    to: 'now-3w/w',
    display: t('services.grafana-ui.date-time-pickers.quick-options.three-weeks-ago', 'Three weeks ago'),
  },
  {
    from: 'now-4w/w',
    to: 'now-4w/w',
    display: t('services.grafana-ui.date-time-pickers.quick-options.four-weeks-ago', 'Four weeks ago'),
  },
  {
    from: 'now-1M/M',
    to: 'now-1M/M',
    display: t('services.grafana-ui.date-time-pickers.quick-options.previous-month', 'Previous month'),
  },
  {
    from: 'now-2M/M',
    to: 'now-2M/M',
    display: t('services.grafana-ui.date-time-pickers.quick-options.two-months-ago', 'Two months ago'),
  },
  {
    from: 'now-3M/M',
    to: 'now-3M/M',
    display: t('services.grafana-ui.date-time-pickers.quick-options.three-months-ago', 'Three months ago'),
  },

  { from: 'now/d', to: 'now/d', display: t('services.grafana-ui.date-time-pickers.quick-options.today', 'Today') },
  {
    from: 'now/d',
    to: 'now',
    display: t('services.grafana-ui.date-time-pickers.quick-options.today-so-far', 'Today so far'),
  },
  {
    from: 'now/w',
    to: 'now/w',
    display: t('services.grafana-ui.date-time-pickers.quick-options.this-week', 'This week'),
  },
  {
    from: 'now/w',
    to: 'now',
    display: t('services.grafana-ui.date-time-pickers.quick-options.this-week-so-far', 'This week so far'),
  },
  {
    from: 'now/M',
    to: 'now/M',
    display: t('services.grafana-ui.date-time-pickers.quick-options.this-month', 'This month'),
  },
  {
    from: 'now/M',
    to: 'now',
    display: t('services.grafana-ui.date-time-pickers.quick-options.this-month-so-far', 'This month so far'),
  },
];
