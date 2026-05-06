/**
 * Captured `GET /resources/detected_fields` response for
 * `{service_name="tempo-ingester"}`.
 */
export const detectedFields = {
  fields: [
    {
      label: 'key',
      type: 'string',
      cardinality: 1,
      parsers: ['logfmt'],
    },
    {
      label: 'version',
      type: 'int',
      cardinality: 9,
      parsers: ['logfmt'],
    },
    {
      label: 'seconds',
      type: 'int',
      cardinality: 17,
      parsers: ['logfmt'],
    },
    {
      label: 'objects',
      type: 'int',
      cardinality: 10,
      parsers: ['logfmt'],
    },
    {
      label: 'level_extracted',
      type: 'string',
      cardinality: 4,
      parsers: ['logfmt'],
    },
    {
      label: 'detected_level',
      type: 'string',
      cardinality: 4,
      parsers: null,
    },
    {
      label: 'userid',
      type: 'int',
      cardinality: 5,
      parsers: ['logfmt'],
    },
    {
      label: 'content',
      type: 'string',
      cardinality: 11,
      parsers: ['logfmt'],
    },
    {
      label: 'tenant',
      type: 'int',
      cardinality: 4,
      parsers: ['logfmt'],
    },
    {
      label: 'oldVersion',
      type: 'int',
      cardinality: 11,
      parsers: ['logfmt'],
    },
    {
      label: 'active_series',
      type: 'int',
      cardinality: 11,
      parsers: ['logfmt'],
    },
    {
      label: 'caller',
      type: 'string',
      cardinality: 8,
      parsers: ['logfmt'],
    },
    {
      label: 'err',
      type: 'string',
      cardinality: 5,
      parsers: ['logfmt'],
    },
    {
      label: 'msg',
      type: 'string',
      cardinality: 11,
      parsers: ['logfmt'],
    },
    {
      label: 'user',
      type: 'int',
      cardinality: 9,
      parsers: null,
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
      cardinality: 30,
      parsers: null,
    },
    {
      label: 'values',
      type: 'int',
      cardinality: 10,
      parsers: ['logfmt'],
    },
    {
      label: 'oldContent',
      type: 'string',
      cardinality: 11,
      parsers: ['logfmt'],
    },
    {
      label: 'bytes',
      type: 'bytes',
      cardinality: 10,
      parsers: ['logfmt'],
    },
    {
      label: 'blockID',
      type: 'string',
      cardinality: 10,
      parsers: ['logfmt'],
    },
    {
      label: 'pod',
      type: 'string',
      cardinality: 49,
      parsers: null,
    },
  ],
  limit: 1000,
} as const;
