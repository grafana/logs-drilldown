/**
 * Hand-written `GET /resources/detected_fields` response for `{namespace="gateway"}`.
 * Field count drives the Fields tab badge.
 */
export const detectedFields = {
  fields: [
    { label: 'method', type: 'string', cardinality: 4, parsers: ['logfmt'] },
    { label: 'status', type: 'int', cardinality: 7, parsers: ['logfmt'] },
    { label: 'path', type: 'string', cardinality: 24, parsers: ['logfmt'] },
    { label: 'duration_ms', type: 'int', cardinality: 87, parsers: ['logfmt'] },
    { label: 'remote_addr', type: 'string', cardinality: 14, parsers: ['logfmt'] },
    { label: 'detected_level', type: 'string', cardinality: 4, parsers: null },
  ],
  limit: 1000,
} as const;
