import { OFREPWebProvider } from '@openfeature/ofrep-web-provider';
import { ClientProviderStatus, OpenFeature, ProviderEvents, type Client, type JsonValue } from '@openfeature/web-sdk';

import { config } from '@grafana/runtime';

import { TrackingHook } from './tracking';
import { logger } from 'services/logger';
import { getObjectKeys } from 'services/utils';

/**
 * All feature flags that we intend to use from the GoFF service are defined here.
 * {@link https://github.com/grafana/deployment_tools/blob/master/ksonnet/environments/hosted-grafana/waves/feature-toggles/goff/drilldown/logs/flag-definitions.libsonnet | Metrics Drilldown GoFF flag definitions} for the source of truth.
 */
const goffFeatureFlags = {
  'drilldown.logs.aggregated_metrics': {
    valueType: 'string',
    values: [
      'treatment', // The sidebar opens by default
      'control', // The sidebar remains closed (default behavior)
      'excluded', // The user is excluded from experiment (sidebar remains closed)
    ],
    defaultValue: 'excluded',
    trackingKey: 'experiment_aggregated_metrics',
  },
} as const satisfies Record<`drilldown.logs.${string}`, FeatureFlag>;

/**
 * This discriminated union captures the different types of feature flags that can be evaluated.
 *
 * @param valueType - The type of the feature flag value.
 * @param values - The possible values for the feature flag.
 * @param defaultValue - The default value for the feature flag.
 * @param trackingKey - If provided, the feature flag value will be tracked using the given key.
 */
type FeatureFlag =
  | { defaultValue: boolean; trackingKey?: string; values: readonly boolean[]; valueType: 'boolean' }
  | {
      defaultValue: JsonValue;
      trackingKey?: string;
      values: readonly JsonValue[];
      valueType: 'object';
    }
  | {
      defaultValue: number;
      trackingKey?: string;
      values: readonly number[];
      valueType: 'number';
    }
  | {
      defaultValue: string;
      trackingKey?: string;
      values: readonly string[];
      valueType: 'string';
    };

const featureFlagNames = getObjectKeys(goffFeatureFlags);
export type FeatureFlagName = (typeof featureFlagNames)[number];
export type FlagValue<T extends FeatureFlagName> = (typeof goffFeatureFlags)[T]['values'][number];
export type FlagTrackingKey = (typeof goffFeatureFlags)[keyof typeof goffFeatureFlags] extends infer Flag
  ? Flag extends { trackingKey: infer K }
    ? K
    : never
  : never;

export const featureFlagTrackingKeys = Object.fromEntries(
  featureFlagNames.reduce<Array<[FeatureFlagName, FlagTrackingKey]>>((acc, flagName) => {
    const flagDef = goffFeatureFlags[flagName];
    if ('trackingKey' in flagDef) {
      acc.push([flagName, flagDef.trackingKey as FlagTrackingKey]);
    }
    return acc;
  }, [])
);

/**
 * OpenFeature domain for the logs-drilldown plugin.
 * This isolates our provider from Grafana core and other plugins.
 */
export const OPEN_FEATURE_DOMAIN = 'logs-drilldown';

/**
 * Initializes the OpenFeature provider for the logs-drilldown plugin.
 * This function should be called once during app initialization.
 *
 * @remarks
 * The provider is only initialized if it hasn't been set yet (checked by comparing to default provider).
 * This prevents re-initialization if the app component re-renders.
 */
export function initOpenFeatureProvider(): Promise<void> {
  return OpenFeature.setProviderAndWait(
    OPEN_FEATURE_DOMAIN,
    new OFREPWebProvider({
      baseUrl: `/apis/features.grafana.app/v0alpha1/namespaces/${config.namespace}`,
      pollInterval: -1, // Do not poll - flags are fetched once on init
      timeoutMs: 10_000, // Timeout after 10 seconds
    }),
    {
      targetingKey: config.namespace, // Dimension of uniqueness, to ensure flags are evaluated consistently for a given stack
      namespace: config.namespace, // Required by the multi-tenant feature flag service
      ...config.openFeatureContext,
    }
  ).catch((error) => {
    // OpenFeature initialization may fail in environments without the feature flag service.
    // This is expected and the app will continue to work with default flag values.
    logger.warn('OpenFeature provider initialization failed, using default flag values', {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

/**
 * Helper to wait for a client to be ready.
 */
function waitForClientReady(client: Client): Promise<void> {
  if (client.providerStatus === ClientProviderStatus.READY) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    client.addHandler(ProviderEvents.Ready, () => resolve());
  });
}

/**
 * Evaluates a feature flag from the GoFF service.
 *
 * @param flagName - The name of the feature flag to evaluate.
 * @returns The value of the feature flag.
 */
export async function evaluateFeatureFlag<T extends keyof typeof goffFeatureFlags>(flagName: T): Promise<FlagValue<T>> {
  try {
    const client = OpenFeature.getClient(OPEN_FEATURE_DOMAIN);
    await waitForClientReady(client);
    client.addHooks(new TrackingHook());
    const flagDef = goffFeatureFlags[flagName] as FeatureFlag;

    console.log('flagDef', flagDef);

    switch (flagDef.valueType) {
      case 'boolean':
        const booleanValue = client.getBooleanValue(flagName, flagDef.defaultValue);
        // @ts-expect-error - this can be removed once we add a boolean-type flag to `goffFeatureFlags`
        return booleanValue as FlagValue<T>;
      case 'number':
        const numberValue = client.getNumberValue(flagName, flagDef.defaultValue);
        // @ts-expect-error - this can be removed once we add a number-type flag to `goffFeatureFlags`
        return numberValue as FlagValue<T>;
      case 'object':
        const objectValue = client.getObjectValue(flagName, flagDef.defaultValue);
        return objectValue as FlagValue<T>;
      case 'string':
        const stringValue = client.getStringValue(flagName, flagDef.defaultValue);
        return stringValue as FlagValue<T>;
      default:
        throw new Error(`Invalid flag value type for flag ${flagName}`);
    }
  } catch (error) {
    // On any error, default to default value
    logger.error(new Error(`Error evaluating ${flagName} flag.`, { cause: error }));
    return goffFeatureFlags[flagName].defaultValue as FlagValue<T>;
  }
}
