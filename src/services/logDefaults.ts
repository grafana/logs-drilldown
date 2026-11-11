export type LogDefaults = {
  fontSize?: 'default' | 'small';
  showTime?: boolean;
  sortOrder?: 'Ascending' | 'Descending';
  wrapLogMessage?: boolean;
};

export const LOG_DEFAULTS_KEYS = ['fontSize', 'showTime', 'sortOrder', 'wrapLogMessage'] as const;

let adminLogDefaults: LogDefaults | undefined;

export function setAdminLogDefaults(defaults: LogDefaults | undefined) {
  adminLogDefaults = defaults;
}

export function getAdminLogDefault(option: string): string | boolean | undefined {
  if (!adminLogDefaults || !(LOG_DEFAULTS_KEYS as readonly string[]).includes(option)) {
    return undefined;
  }
  return adminLogDefaults[option as keyof LogDefaults];
}
