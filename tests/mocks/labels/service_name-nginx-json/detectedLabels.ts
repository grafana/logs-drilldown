/**
 * Captured `GET /resources/detected_labels` response for
 * `{service_name="nginx-json"}`.
 */
export const detectedLabels = {
  detectedLabels: [
    {
      label: 'namespace',
      cardinality: 1,
    },
    {
      label: 'env',
      cardinality: 4,
    },
    {
      label: 'level',
      cardinality: 4,
    },
    {
      label: 'file',
      cardinality: 1,
    },
    {
      label: 'cluster',
      cardinality: 4,
    },
    {
      label: 'service_name',
      cardinality: 1,
    },
    {
      label: 'service',
      cardinality: 1,
    },
  ],
} as const;
