import { AppPluginMeta } from '@grafana/data';

import { plugin } from '../module';
import { JsonData } from 'Components/AppConfig/AppConfig';

export type LogDefaults = {
  fontSize?: 'default' | 'small';
  showTime?: boolean;
  sortOrder?: 'Ascending' | 'Descending';
  wrapLogMessage?: boolean;
};

export const LOG_DEFAULTS_KEYS = ['fontSize', 'showTime', 'sortOrder', 'wrapLogMessage'] as const;

export function getAdminLogDefault(option: string): string | boolean | undefined {
  const { jsonData } = plugin.meta as AppPluginMeta<JsonData>;
  const adminLogDefaults = jsonData?.logDefaults;
  if (!adminLogDefaults || !(LOG_DEFAULTS_KEYS as readonly string[]).includes(option)) {
    return undefined;
  }
  return adminLogDefaults[option as keyof LogDefaults];
}
