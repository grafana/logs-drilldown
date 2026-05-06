/**
 * Hand-written `GET /resources/detected_labels` response for `{namespace="gateway"}`.
 * Cardinality count is what the breakdown tab displays.
 */
export const detectedLabels = {
  detectedLabels: [
    { label: 'cluster', cardinality: 4 },
    { label: 'env', cardinality: 5 },
    { label: 'service_name', cardinality: 1 },
    { label: 'namespace', cardinality: 1 },
    { label: 'level', cardinality: 4 },
    { label: 'service', cardinality: 1 },
  ],
} as const;
