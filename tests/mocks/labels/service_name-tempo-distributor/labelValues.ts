/**
 * Captured `GET /resources/label/<name>/values` responses for
 * `{service_name="tempo-distributor"}`. Keyed by label name.
 */
export const labelValues: Record<string, string[]> = {
  cluster: ['us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'eu-west-1'],
  detected_level: ['debug', 'info', 'warn', 'error'],
  level: ['debug', 'info', 'warn', 'error'],
  namespace: ['gateway', 'mimir', 'tempo', 'loki', 'grafana', 'monitoring'],
  service: [
    'tempo-distributor',
    'tempo-ingester',
    'mimir-ingester',
    'mimir-distributor',
    'nginx',
    'nginx-json',
    'nginx-json-mixed',
    'httpd',
    'apache',
    'gateway',
    'loki',
  ],
  // service_name dropdown options used when switching the active service from
  // a breakdown filter chip (e.g. test 'should update label set if
  // detected_labels is loaded in another tab').
  service_name: [
    'tempo-distributor',
    'tempo-ingester',
    'mimir-ingester',
    'mimir-distributor',
    'nginx',
    'nginx-json',
    'nginx-json-mixed',
    'httpd',
    'apache',
    'gateway',
    'loki',
  ],
};
