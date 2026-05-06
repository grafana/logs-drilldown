/**
 * Hand-written `GET /resources/detected_field/<name>/values` responses for
 * `{namespace="mimir"}`. Keyed by field name.
 */
export const fieldValues: Record<string, string[]> = {
  caller: ['ingester.go:212', 'block.go:81', 'querier.go:140', 'ruler.go:55', 'compactor.go:118'],
  msg: ['successfully appended', 'block uploaded', 'slow query', 'rule evaluation failed', 'compaction shard'],
  tenant: ['tenant-a', 'tenant-b', 'tenant-c', 'anonymous'],
  series: ['1', '12', '128', '512', '2048'],
  user: ['admin', 'editor', 'viewer'],
  duration_ms: ['12', '34', '78', '156', '512'],
  shard: ['0', '1', '2', '3'],
  block_id: ['01H7G3', '01H7H1', '01H7J9'],
  detected_level: ['debug', 'info', 'warn', 'error'],
};
