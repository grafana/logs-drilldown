/**
 * Hand-written `GET /resources/detected_labels` response for `{namespace="mimir"}`.
 * Distinct count vs `namespace-gateway` so Part 2 of the namespace tabs test can
 * assert the labels tab badge changed when switching primary label.
 */
export const detectedLabels = {
  detectedLabels: [
    { label: 'cluster', cardinality: 4 },
    { label: 'env', cardinality: 5 },
    { label: 'service_name', cardinality: 4 },
    { label: 'namespace', cardinality: 1 },
    { label: 'level', cardinality: 4 },
    { label: 'service', cardinality: 4 },
    { label: 'pod', cardinality: 12 },
    { label: 'component', cardinality: 8 },
  ],
} as const;
