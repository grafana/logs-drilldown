/**
 * Hand-written `GET /resources/label/<name>/values` responses for
 * `{namespace="mimir"}`. Keyed by label name.
 */
export const labelValues: Record<string, string[]> = {
  cluster: ['us-east-1', 'us-east-2', 'us-west-1', 'us-west-2'],
  env: ['prod', 'dev', 'staging', 'monitoring', 'infra'],
  level: ['debug', 'info', 'warn', 'error'],
  detected_level: ['debug', 'info', 'warn', 'error'],
  // The dropdown that lets a user switch primary label needs to see every
  // namespace value, not just the currently-selected one.
  namespace: ['gateway', 'mimir'],
  service: ['mimir-distributor', 'mimir-ingester', 'mimir-querier', 'mimir-ruler'],
  service_name: ['mimir-distributor', 'mimir-ingester', 'mimir-querier', 'mimir-ruler'],
};
