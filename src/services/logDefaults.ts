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

// Prettify follows wrap, as the wrap toggle in the UI sets both
export function getAdminLogDefault(option: string): string | boolean | undefined {
  const key = option === 'prettifyLogMessage' ? 'wrapLogMessage' : option;
  if (!adminLogDefaults || !(LOG_DEFAULTS_KEYS as readonly string[]).includes(key)) {
    return undefined;
  }
  return adminLogDefaults[key as keyof LogDefaults];
}
