/**
 * Captured `GET /resources/detected_field/<name>/values` responses for
 * `{service_name="tempo-distributor"}`. Keyed by field name.
 */
export const fieldValues: Record<string, string[]> = {
  bytes: ['128', '256', '512', '1024', '2048', '4096'],
  // The Levels variable combobox queries `/resources/detected_field/detected_level/values`
  // for its options (see IndexScene.getLevelsTagValuesProvider →
  // getDetectedFieldValuesTagValuesProvider). Tests like 'Levels: include
  // detected_level values' expect debug/error/info/warn options to be present.
  detected_level: ['debug', 'info', 'warn', 'error'],
  // Sampled from the content refId frames in dsQuery.json. Tests like
  // 'field/label value breakdown: changing parser updates query' open the
  // content field-values combobox and expect at least one option matching
  // the `[compactor-...]` pattern.
  content: [
    '[compactor-01t7b]',
    '[compactor-03jni]',
    '[compactor-03kyr]',
    '[compactor-03r0d]',
    '[compactor-05wsd]',
    '[compactor-065gi]',
    '[compactor-07unm]',
    '[compactor-08d9b]',
    '[compactor-09mqj]',
    '[compactor-0aapy]',
  ],
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
  pod: ['compactor-abc12', 'mimir-ingester-def34', 'tempo-distributor-ghi56', 'nginx-jkl78', 'apache-mno90'],
  tenant: ['tenant-a', 'tenant-b', 'tenant-c', 'anonymous'],
  user: ['admin', 'editor', 'viewer', '03428', 'anonymous'],
};
