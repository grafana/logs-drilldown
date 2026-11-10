// Circular dependencies can cause enums to return as undefined in jest tests, moving enums here
export enum TabNames {
  logs = 'Logs',
  labels = 'Labels',
  fields = 'Fields',
  patterns = 'Patterns',
}

export enum PageSlugs {
  explore = 'explore',
  logs = 'logs',
  labels = 'labels',
  patterns = 'patterns',
  fields = 'fields',
  embed = 'embed',
  embedMini = 'embed-mini',
  embedMiniLogsOnly = 'embed-mini-logs-only',
  embedMiniVolumeOnly = 'embed-mini-volume-only',
}

export enum ValueSlugs {
  field = 'field',
  label = 'label',
}
