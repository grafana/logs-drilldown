/**
 * Captured `GET /resources/detected_fields` response for
 * `{service_name="tempo-distributor"}`.
 */
export const detectedFields = {
  fields: [
    {
      label: 'msg',
      type: 'string',
      cardinality: 12,
      parsers: ['logfmt'],
    },
    {
      label: 'ts',
      type: 'string',
      cardinality: 100,
      parsers: ['logfmt'],
    },
    {
      label: 'traceID',
      type: 'string',
      cardinality: 22,
      parsers: null,
    },
    {
      label: 'seconds',
      type: 'int',
      cardinality: 9,
      parsers: ['logfmt'],
    },
    {
      label: 'user',
      type: 'int',
      cardinality: 9,
      parsers: null,
    },
    {
      label: 'blockID',
      type: 'string',
      cardinality: 10,
      parsers: ['logfmt'],
    },
    {
      label: 'oldContent',
      type: 'string',
      cardinality: 15,
      parsers: ['logfmt'],
    },
    {
      label: 'level_extracted',
      type: 'string',
      cardinality: 4,
      parsers: ['logfmt'],
    },
    {
      label: 'version',
      type: 'string',
      cardinality: 15,
      parsers: ['logfmt'],
    },
    {
      label: 'key',
      type: 'string',
      cardinality: 1,
      parsers: ['logfmt'],
    },
    {
      label: 'userid',
      type: 'int',
      cardinality: 5,
      parsers: ['logfmt'],
    },
    {
      label: 'detected_level',
      type: 'string',
      cardinality: 4,
      parsers: null,
    },
    {
      label: 'caller',
      type: 'string',
      cardinality: 8,
      parsers: ['logfmt'],
    },
    {
      label: 'bytes',
      type: 'bytes',
      cardinality: 10,
      parsers: ['logfmt'],
    },
    {
      label: 'values',
      type: 'int',
      cardinality: 10,
      parsers: ['logfmt'],
    },
    {
      label: 'active_series',
      type: 'int',
      cardinality: 13,
      parsers: ['logfmt'],
    },
    {
      label: 'err',
      type: 'string',
      cardinality: 5,
      parsers: ['logfmt'],
    },
    {
      label: 'tenant',
      type: 'int',
      cardinality: 5,
      parsers: ['logfmt'],
    },
    {
      label: 'pod',
      type: 'string',
      cardinality: 39,
      parsers: null,
    },
    {
      label: 'objects',
      type: 'int',
      cardinality: 10,
      parsers: ['logfmt'],
    },
    {
      label: 'content',
      type: 'string',
      cardinality: 15,
      parsers: ['logfmt'],
    },
    {
      label: 'oldVersion',
      type: 'int',
      cardinality: 14,
      parsers: ['logfmt'],
    },
  ],
  limit: 1000,
} as const;
