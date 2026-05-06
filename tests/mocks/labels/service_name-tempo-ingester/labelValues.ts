/**
 * Captured `GET /resources/label/<name>/values` responses for
 * `{service_name="tempo-ingester"}`. Keyed by label name.
 */
export const labelValues: Record<string, string[]> = {
  cluster: ['us-east-1', 'us-east-2', 'us-west-1', 'us-west-2'],
  deployment_environment: ['prod', 'dev', 'staging', 'monitoring', 'infra'],
  env: ['prod', 'dev', 'staging', 'monitoring', 'infra'],
  file: ['/var/log/app.log', '/var/log/error.log', '/var/log/access.log', '/var/log/debug.log', '/var/log/system.log'],
  k8s_cluster_name: ['us-east-1', 'us-east-2', 'us-west-1', 'us-west-2'],
  k8s_namespace_name: ['gateway', 'mimir', 'tempo'],
  level: ['debug', 'info', 'warn', 'error'],
  detected_level: ['debug', 'info', 'warn', 'error'],
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
};
