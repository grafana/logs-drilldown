/**
 * Static mocks for Loki metadata used on the plugin admin **Default fields** page in e2e.
 *
 * Grafana calls Loki labels / `detected_fields` through the datasource proxy. These payloads
 * keep the admin UI deterministic; log lines for the preview still come from real `ds/query`
 * where the spec allows it.
 *
 * Shapes match Loki / Grafana `getResource` responses (see `fetchDetectedFields` in
 * `src/services/TagKeysProviders.ts` for detected fields).
 */
import { mockLabelsResponse } from './mockLabelsResponse';

const LABEL_VALUES_BY_NAME: Record<string, string[]> = {
  service_name: ['apache', 'gateway', 'mimir', 'nginx', 'tempo-distributor'],
  namespace: ['gateway'],
  env: ['dev', 'infra', 'monitoring', 'prod', 'staging'],
  cluster: ['eu-east-1', 'eu-west-1', 'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2'],
};

const DEFAULT_LABEL_VALUES = ['value-a', 'value-b'];

/** Loki labels list: `{ status, data: string[] }`. Omits `traceID` from label keys so it only appears under detected fields in the column combobox. */
export const getMockDefaultColumnsLabelsListApiResponse = () => ({
  status: 'success' as const,
  data: [...mockLabelsResponse.data, 'pod'].sort(),
});

/** Loki label values for `GET …/label/<name>/values` (optional; default-columns e2e may use a single static list instead). */
export const getMockDefaultColumnsLabelValuesApiResponse = (labelName: string) => {
  const values = LABEL_VALUES_BY_NAME[labelName] ?? DEFAULT_LABEL_VALUES;
  return { status: 'success' as const, data: values };
};

/** `detected_fields` resource body (`fields` is what the app reads from `getResource`). */
export const getMockDefaultColumnsDetectedFieldsApiResponse = () => ({
  limit: 1000,
  fields: [
    { label: 'traceID', cardinality: 10, parsers: ['logfmt'] as const, type: 'string' as const },
    { label: 'file', cardinality: 2, parsers: ['logfmt'] as const, type: 'string' as const },
    { label: 'caller', cardinality: 4, parsers: ['logfmt'] as const, type: 'string' as const },
    { label: 'detected_level', cardinality: 4, parsers: ['logfmt'] as const, type: 'string' as const },
  ],
});
