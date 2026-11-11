import { AppPluginMeta, LogsSortOrder } from '@grafana/data';

import { plugin } from '../module';
import { JsonData } from 'Components/AppConfig/AppConfig';

export type LogDefaults = {
  fontSize?: 'default' | 'small';
  prettifyLogMessage?: boolean;
  showTime?: boolean;
  sortOrder?: 'Ascending' | 'Descending';
  wrapLogMessage?: boolean;
};

export const LOG_DEFAULTS_KEYS = ['fontSize', 'prettifyLogMessage', 'showTime', 'sortOrder', 'wrapLogMessage'] as const;

export const BUILT_IN_LOG_DEFAULTS = {
  fontSize: 'default',
  prettifyLogMessage: false,
  showTime: true,
  sortOrder: LogsSortOrder.Descending,
  wrapLogMessage: false,
} as const satisfies Required<LogDefaults>;

const isLogDefaultsKey = (option: string): option is keyof LogDefaults => LOG_DEFAULTS_KEYS.some((k) => k === option);

export function getAdminLogDefault(option: string): string | boolean | undefined {
  const { jsonData } = plugin.meta as AppPluginMeta<JsonData>;
  const adminLogDefaults = jsonData?.logDefaults;
  return adminLogDefaults && isLogDefaultsKey(option) ? adminLogDefaults[option] : undefined;
}
