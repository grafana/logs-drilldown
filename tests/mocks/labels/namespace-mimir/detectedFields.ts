/**
 * Hand-written `GET /resources/detected_fields` response for `{namespace="mimir"}`.
 * Distinct count vs `namespace-gateway` so Part 2 of the namespace tabs test can
 * assert the fields tab badge changed when switching primary label.
 */
export const detectedFields = {
  fields: [
    { label: 'caller', type: 'string', cardinality: 18, parsers: ['logfmt'] },
    { label: 'msg', type: 'string', cardinality: 32, parsers: ['logfmt'] },
    { label: 'tenant', type: 'int', cardinality: 4, parsers: ['logfmt'] },
    { label: 'series', type: 'int', cardinality: 91, parsers: ['logfmt'] },
    { label: 'user', type: 'string', cardinality: 7, parsers: null },
    { label: 'duration_ms', type: 'int', cardinality: 60, parsers: ['logfmt'] },
    { label: 'shard', type: 'int', cardinality: 16, parsers: ['logfmt'] },
    { label: 'block_id', type: 'string', cardinality: 22, parsers: ['logfmt'] },
    { label: 'detected_level', type: 'string', cardinality: 4, parsers: null },
  ],
  limit: 1000,
} as const;
