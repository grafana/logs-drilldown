import { AppPluginMeta, getTimeZone, rangeUtil, TimeOption } from '@grafana/data';
import { t } from '@grafana/i18n';

import { JsonData } from '../Components/AppConfig/AppConfig';
import { plugin } from '../module';
import { LokiConfig } from './datasourceTypes';

/**
 * Filters TimeOptions that are more than the max query duration, the retention period, or duration defined in plugin admin config
 * Loki config will override admin config
 * max_query_length will override retention_period
 * @todo should we support only applying limits to sharded/split for backward compat?
 */
export const filterInvalidTimeOptions = (timeOptions: TimeOption[], lokiConfig?: LokiConfig) => {
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

    const maxInterval = maxQueryLengthSeconds || maxRetentionSeconds || maxPluginConfigSeconds;
    if (maxInterval) {
      const timeZone = getTimeZone();
      return timeOptions.filter((timeOption) => {
        const timeRange = rangeUtil.convertRawToRange(timeOption, timeZone);
        if (timeRange) {
          const intervalSeconds = Math.floor((timeRange.to.valueOf() - timeRange.from.valueOf()) / 1000);
          return intervalSeconds === 0 || intervalSeconds <= maxInterval;
        }

        return 0;
      });
    }
  }

  return timeOptions;
};

export const quickOptions: TimeOption[] = [
  { from: 'now-5m', to: 'now', display: t('grafana-ui.date-time-pickers.quick-options.last-5-mins', 'Last 5 minutes') },
  {
    from: 'now-15m',
    to: 'now',
    display: t('grafana-ui.date-time-pickers.quick-options.last-15-mins', 'Last 15 minutes'),
  },
  {
    from: 'now-30m',
    to: 'now',
    display: t('grafana-ui.date-time-pickers.quick-options.last-30-mins', 'Last 30 minutes'),
  },
  { from: 'now-1h', to: 'now', display: t('grafana-ui.date-time-pickers.quick-options.last-1-hour', 'Last 1 hour') },
  { from: 'now-3h', to: 'now', display: t('grafana-ui.date-time-pickers.quick-options.last-3-hours', 'Last 3 hours') },
  { from: 'now-6h', to: 'now', display: t('grafana-ui.date-time-pickers.quick-options.last-6-hours', 'Last 6 hours') },
  {
    from: 'now-12h',
    to: 'now',
    display: t('grafana-ui.date-time-pickers.quick-options.last-12-hours', 'Last 12 hours'),
  },
  {
    from: 'now-24h',
    to: 'now',
    display: t('grafana-ui.date-time-pickers.quick-options.last-24-hours', 'Last 24 hours'),
  },
  { from: 'now-2d', to: 'now', display: t('grafana-ui.date-time-pickers.quick-options.last-2-days', 'Last 2 days') },
  { from: 'now-7d', to: 'now', display: t('grafana-ui.date-time-pickers.quick-options.last-7-days', 'Last 7 days') },
  { from: 'now-30d', to: 'now', display: t('grafana-ui.date-time-pickers.quick-options.last-30-days', 'Last 30 days') },
  { from: 'now-60d', to: 'now', display: t('grafana-ui.date-time-pickers.quick-options.last-60-days', 'Last 60 days') },
  { from: 'now-90d', to: 'now', display: t('grafana-ui.date-time-pickers.quick-options.last-90-days', 'Last 90 days') },
  {
    from: 'now-6M',
    to: 'now',
    display: t('grafana-ui.date-time-pickers.quick-options.last-6-months', 'Last 6 months'),
  },
  { from: 'now-1y', to: 'now', display: t('grafana-ui.date-time-pickers.quick-options.last-1-year', 'Last 1 year') },
  { from: 'now-1d/d', to: 'now-1d/d', display: t('grafana-ui.date-time-pickers.quick-options.yesterday', 'Yesterday') },
  {
    from: 'now-2d/d',
    to: 'now-2d/d',
    display: t('grafana-ui.date-time-pickers.quick-options.day-before-yesterday', 'Day before yesterday'),
  },
  {
    from: 'now-3d/d',
    to: 'now-3d/d',
    display: t('grafana-ui.date-time-pickers.quick-options.day-three-days-ago', 'Three days ago'),
  },
  {
    from: 'now-4d/d',
    to: 'now-4d/d',
    display: t('grafana-ui.date-time-pickers.quick-options.day-four-days-ago', 'Four days ago'),
  },
  {
    from: 'now-5d/d',
    to: 'now-5d/d',
    display: t('grafana-ui.date-time-pickers.quick-options.day-five-days-ago', 'Five days ago'),
  },
  {
    from: 'now-6d/d',
    to: 'now-6d/d',
    display: t('grafana-ui.date-time-pickers.quick-options.day-five-days-ago', 'Six days ago'),
  },
  {
    from: 'now-7d/d',
    to: 'now-7d/d',
    display: t('grafana-ui.date-time-pickers.quick-options.this-day-last-week', 'This day last week'),
  },
  {
    from: 'now-1w/w',
    to: 'now-1w/w',
    display: t('grafana-ui.date-time-pickers.quick-options.previous-week', 'Previous week'),
  },
  {
    from: 'now-2w/w',
    to: 'now-2w/w',
    display: t('grafana-ui.date-time-pickers.quick-options.two-weeks-ago', 'Two weeks ago'),
  },
  {
    from: 'now-3w/w',
    to: 'now-3w/w',
    display: t('grafana-ui.date-time-pickers.quick-options.three-weeks-ago', 'Three weeks ago'),
  },
  {
    from: 'now-4w/w',
    to: 'now-4w/w',
    display: t('grafana-ui.date-time-pickers.quick-options.four-weeks-ago', 'Four weeks ago'),
  },
  {
    from: 'now-1M/M',
    to: 'now-1M/M',
    display: t('grafana-ui.date-time-pickers.quick-options.previous-month', 'Previous month'),
  },
  {
    from: 'now-2M/M',
    to: 'now-2M/M',
    display: t('grafana-ui.date-time-pickers.quick-options.two-months-ago', 'Two months ago'),
  },
  {
    from: 'now-3M/M',
    to: 'now-3M/M',
    display: t('grafana-ui.date-time-pickers.quick-options.three-months-ago', 'Three months ago'),
  },
  {
    from: 'now-1Q/fQ',
    to: 'now-1Q/fQ',
    display: t('grafana-ui.date-time-pickers.quick-options.previous-fiscal-quarter', 'Previous fiscal quarter'),
  },
  {
    from: 'now-1y/y',
    to: 'now-1y/y',
    display: t('grafana-ui.date-time-pickers.quick-options.previous-year', 'Previous year'),
  },
  {
    from: 'now-1y/fy',
    to: 'now-1y/fy',
    display: t('grafana-ui.date-time-pickers.quick-options.previous-fiscal-year', 'Previous fiscal year'),
  },
  { from: 'now/d', to: 'now/d', display: t('grafana-ui.date-time-pickers.quick-options.today', 'Today') },
  { from: 'now/d', to: 'now', display: t('grafana-ui.date-time-pickers.quick-options.today-so-far', 'Today so far') },
  { from: 'now/w', to: 'now/w', display: t('grafana-ui.date-time-pickers.quick-options.this-week', 'This week') },
  {
    from: 'now/w',
    to: 'now',
    display: t('grafana-ui.date-time-pickers.quick-options.this-week-so-far', 'This week so far'),
  },
  { from: 'now/M', to: 'now/M', display: t('grafana-ui.date-time-pickers.quick-options.this-month', 'This month') },
  {
    from: 'now/M',
    to: 'now',
    display: t('grafana-ui.date-time-pickers.quick-options.this-month-so-far', 'This month so far'),
  },
  { from: 'now/y', to: 'now/y', display: t('grafana-ui.date-time-pickers.quick-options.this-year', 'This year') },
  {
    from: 'now/y',
    to: 'now',
    display: t('grafana-ui.date-time-pickers.quick-options.this-year-so-far', 'This year so far'),
  },
  {
    from: 'now/fQ',
    to: 'now',
    display: t('grafana-ui.date-time-pickers.quick-options.this-fiscal-quarter-so-far', 'This fiscal quarter so far'),
  },
  {
    from: 'now/fQ',
    to: 'now/fQ',
    display: t('grafana-ui.date-time-pickers.quick-options.this-fiscal-quarter', 'This fiscal quarter'),
  },
  {
    from: 'now/fy',
    to: 'now',
    display: t('grafana-ui.date-time-pickers.quick-options.this-fiscal-year-so-far', 'This fiscal year so far'),
  },
  {
    from: 'now/fy',
    to: 'now/fy',
    display: t('grafana-ui.date-time-pickers.quick-options.this-fiscal-year', 'This fiscal year'),
  },
];
