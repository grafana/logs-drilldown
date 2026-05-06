/**
 * Captured `GET /resources/detected_labels` response for
 * `{service_name="nginx"}`.
 */
export const detectedLabels = {
  detectedLabels: [
    {
      label: 'env',
      cardinality: 5,
    },
    {
      label: 'service_name',
      cardinality: 1,
    },
    {
      label: 'cluster',
      cardinality: 4,
    },
    {
      label: 'service',
      cardinality: 1,
    },
    {
      label: 'namespace',
      cardinality: 1,
    },
    {
      label: 'level',
      cardinality: 4,
    },
    {
      label: 'file',
      cardinality: 1,
    },
  ],
} as const;
