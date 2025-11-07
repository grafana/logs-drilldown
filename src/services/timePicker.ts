import { AppPluginMeta, getTimeZone, rangeUtil, TimeOption } from '@grafana/data';
import { t } from '@grafana/i18n';

import { JsonData } from '../Components/AppConfig/AppConfig';
import { plugin } from '../module';
import { LokiConfig } from './datasourceTypes';
import { logger } from './logger';

/**
 * Filters TimeOptions that are more than the max query duration, the retention period, or duration defined in plugin admin config
 * Loki config will override admin config
 * max_query_length will override retention_period
 */
export const filterInvalidTimeOptions = (timeOptions: TimeOption[], lokiConfig?: LokiConfig) => {
  const { jsonData } = plugin.meta as AppPluginMeta<JsonData>;

  // @todo add new plugin config to use max query length or not
  // @todo also check query splitting ff?
  if (jsonData?.interval || lokiConfig?.limits.retention_period || lokiConfig?.limits.max_query_length) {
    let maxPluginConfigSeconds = 0,
      maxQueryLengthSeconds = 0,
      maxRetentionSeconds = 0;

    console.log({ lokiConfig });

    if (jsonData?.interval) {
      try {
        maxPluginConfigSeconds = rangeUtil.intervalToSeconds(jsonData.interval);
      } catch (e) {
        logger.error(e, { msg: `${jsonData.interval} is not a valid interval!` });
      }
    }

    if (lokiConfig?.limits.retention_period) {
      try {
        maxRetentionSeconds = rangeUtil.intervalToSeconds(lokiConfig?.limits.retention_period);
      } catch (e) {
        logger.error(e, { msg: `${lokiConfig?.limits.retention_period} is not a valid interval!` });
      }

      if (lokiConfig?.limits.max_query_length) {
        try {
          maxQueryLengthSeconds = rangeUtil.intervalToSeconds(lokiConfig?.limits.max_query_length ?? '');
        } catch (e) {
          logger.error(e, { msg: `${lokiConfig?.limits.max_query_length} is not a valid interval!` });
        }
      }
    }

    if (maxPluginConfigSeconds || maxRetentionSeconds || maxQueryLengthSeconds) {
      const timeZone = getTimeZone();
      return timeOptions.filter((timeOption) => {
        const timeRange = rangeUtil.convertRawToRange(timeOption, timeZone);

        if (timeRange) {
          // this will be an hour off if the interval includes DST
          const intervalSeconds = Math.floor((timeRange.to.valueOf() - timeRange.from.valueOf()) / 1000);
          const maxQueryLengthGreaterThanInterval = intervalSeconds <= maxQueryLengthSeconds;

          if (maxQueryLengthSeconds && !maxQueryLengthGreaterThanInterval) {
            return false;
          }

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

// Taken from grafana-ui/src/components/DateTimePickers/options.ts and adapted for typical logs searches and retentions
export const quickOptions: TimeOption[] = [
  { from: 'now-1m', to: 'now', display: t('grafana-ui.date-time-pickers.quick-options.last-1-mins', 'Last minute') },
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
  { from: 'now-1d/d', to: 'now-1d/d', display: t('grafana-ui.date-time-pickers.quick-options.yesterday', 'Yesterday') },
  {
    from: 'now-2d/d',
    to: 'now-2d/d',
    display: t('grafana-ui.date-time-pickers.quick-options.day-before-yesterday', 'Day before yesterday'),
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
    from: 'now-1M/M',
    to: 'now-1M/M',
    display: t('grafana-ui.date-time-pickers.quick-options.previous-month', 'Previous month'),
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
];
