/**
 * Captured `GET /resources/detected_field/<name>/values` responses for
 * `{service_name="tempo-ingester"}`. Keyed by field name.
 */
export const fieldValues: Record<string, string[]> = {
  bytes: ['128', '256', '512', '1024', '2048', '4096'],
  caller: [
    'memcached.go:153',
    'broadcast.go:48',
    'instance.go:43',
    'main.go:107',
    'poller.go:133',
    'registry.go:232',
    'compactor.go:242',
    'flush.go:253',
  ],
  err: ['connection refused', 'timeout', 'invalid token', 'not found', 'permission denied'],
  msg: [
    'Failed to get keys from memcached',
    'Invalidating forwarded broadcast',
    'Starting Grafana Enterprise Traces',
    'blocklist poll complete',
    'collecting metrics',
    'flushed to block',
    'completing block',
  ],
  pod: ['gateway-abc12', 'mimir-ingester-def34', 'tempo-distributor-ghi56', 'nginx-jkl78', 'apache-mno90'],
  tenant: ['tenant-a', 'tenant-b', 'tenant-c', 'anonymous'],
  user: ['admin', 'editor', 'viewer', '03428', 'anonymous'],
};
