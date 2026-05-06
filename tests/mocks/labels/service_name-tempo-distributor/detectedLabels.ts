/**
 * Captured `GET /resources/detected_labels` response for
 * `{service_name="tempo-distributor"}`.
 */
export const detectedLabels = {
  detectedLabels: [
    {
      label: 'service_name',
      cardinality: 1,
    },
    {
      label: 'level',
      cardinality: 4,
    },
    {
      label: 'file',
      cardinality: 2,
    },
    {
      label: 'service',
      cardinality: 1,
    },
    {
      label: 'namespace',
      cardinality: 2,
    },
    {
      label: 'env',
      cardinality: 5,
    },
    {
      label: 'cluster',
      cardinality: 4,
    },
  ],
} as const;
