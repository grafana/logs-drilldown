// grafana/grafana/packages/grafana-api-clients/src/utils/utils.ts
import { config, isFetchError } from '@grafana/runtime';

export const getAPIBaseURL = (group: string, version: string) => {
  return `/apis/${group}/${version}/namespaces/${getAPINamespace()}` as const;
};

export const getAPINamespace = () => config.namespace;

export function handleRequestError(error: unknown) {
  if (isFetchError(error) || error instanceof Error) {
    return { error };
  } else {
    return { error: new Error('Unknown error') };
  }
}
