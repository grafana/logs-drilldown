import { AppPluginMeta } from '@grafana/data';

import { JsonData } from '../Components/AppConfig/AppConfig';
import { plugin } from '../module';
import { LokiConfig } from './datasourceTypes';
import { logger } from './logger';
import { parsePrometheusDuration } from './parsePrometheusDuration';

/**
 * Parses Loki config API limit into seconds
 * max_query_length is only used to limit time range options if `limitMaxQueryLength` is set in the admin plugin config
 * Returns 0 if no limit is set
 * @param lokiConfig
 */
export function getMaxQueryLengthSeconds(lokiConfig: LokiConfig): number {
  const { jsonData } = plugin.meta as AppPluginMeta<JsonData>;
  if (lokiConfig?.limits.max_query_length && jsonData?.limitMaxQueryLength) {
    try {
      return Math.floor(parsePrometheusDuration(lokiConfig.limits.max_query_length) / 1000);
    } catch (e) {
      logger.error(e, { msg: `${lokiConfig.limits.max_query_length} is not a valid interval!` });
    }
  }
  return 0;
}
