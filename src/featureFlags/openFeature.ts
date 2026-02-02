import { OFREPWebProvider } from '@openfeature/ofrep-web-provider';
import { ClientProviderStatus, OpenFeature, ProviderEvents, type Client, type JsonValue } from '@openfeature/web-sdk';

import { config } from '@grafana/runtime';

import { TrackingHook } from './tracking';
import { logger } from 'services/logger';
import { getObjectKeys } from 'services/utils';

/**
 * Maps valueType strings to their corresponding TypeScript types.
 */
type ValueTypeMap = {
  boolean: boolean;
  number: number;
  object: JsonValue;
  string: string;
};

/**
 * Core feature flag definition matching the OpenFeature OFREP response format.
 * Used for flags that come from Grafana core.
 *
 * @example
 * ```ts
 * const flag: CoreFeatureFlag<'boolean'> = {
 *   valueType: 'boolean',
 *   value: true,
 *   reason: 'static provider evaluation result',
 *   variant: 'default',
 * };
 * ```
 */
type CoreFeatureFlag<VT extends keyof ValueTypeMap> = {
  reason: string;
  value: ValueTypeMap[VT];
  valueType: VT;
  variant: string;
};

/**
 * Experiment feature flag definition for logs-drilldown scoped flags.
 * Used for A/B testing and feature experiments.
 *
 * @example
 * ```ts
 * const flag: ExperimentFeatureFlag<'string', readonly ['treatment', 'control']> = {
 *   valueType: 'string',
 *   values: ['treatment', 'control'],
 *   defaultValue: 'control',
 *   trackingKey: 'experiment_name',
 * };
 * ```
 */
type ExperimentFeatureFlag<
  VT extends keyof ValueTypeMap,
  Values extends ReadonlyArray<ValueTypeMap[VT]> = ReadonlyArray<ValueTypeMap[VT]>
> = {
  defaultValue: Values[number];
  trackingKey?: string;
  values: Values;
  valueType: VT;
};

/**
 * Union type of all possible feature flag configurations.
 * Supports both core OFREP flags and experiment flags.
 */
type FeatureFlag =
  | CoreFeatureFlag<'boolean'>
  | CoreFeatureFlag<'number'>
  | CoreFeatureFlag<'object'>
  | CoreFeatureFlag<'string'>
  | ExperimentFeatureFlag<'boolean'>
  | ExperimentFeatureFlag<'number'>
  | ExperimentFeatureFlag<'object'>
  | ExperimentFeatureFlag<'string'>;

/**
 * Helper to get the default value from a feature flag definition.
 * Works for both core flags (value) and experiment flags (defaultValue).
 */
type GetFlagDefault<F> = F extends { value: infer V } ? V : F extends { defaultValue: infer D } ? D : never;

/**
 * All Logs Drilldown feature flags that we intend to use from the GoFF service are defined here.
 * {@link https://github.com/grafana/deployment_tools/blob/master/ksonnet/environments/hosted-grafana/waves/feature-toggles/goff/drilldown/logs/flag-definitions.libsonnet} for the source of truth.
 * Core feature flags are defined in the {@link https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/types/featureToggles.gen.ts} file.
 */
const goffFeatureFlags = {
  exploreLogsAggregatedMetrics: {
    valueType: 'boolean',
    value: false,
    reason: 'static provider evaluation result',
    variant: 'default',
  },
  'drilldown.logs.fake_flag': {
    valueType: 'string',
    values: [
      'treatment',
      'control', // default behavior
      'excluded',
    ],
    defaultValue: 'excluded',
    trackingKey: 'experiment_fake_flag',
  },
} as const satisfies Record<string, FeatureFlag>;

const featureFlagNames = getObjectKeys(goffFeatureFlags);
export type FeatureFlagName = (typeof featureFlagNames)[number];
export type FlagValue<T extends FeatureFlagName> = GetFlagDefault<(typeof goffFeatureFlags)[T]>;
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
 * Cache for evaluated feature flag values.
 * Populated during app initialization via `initializeFeatureFlags()`.
 * Use `getFeatureFlag()` for synchronous access after initialization.
 */
const featureFlagCache = new Map<FeatureFlagName, FlagValue<FeatureFlagName>>();

/**
 * Gets a feature flag value synchronously from the cache.
 * Returns the default value if the flag hasn't been evaluated yet.
 *
 * @param flagName - The name of the feature flag
 * @returns The cached flag value, or the default if not yet initialized
 */
export function getFeatureFlag<T extends FeatureFlagName>(flagName: T): FlagValue<T> {
  if (featureFlagCache.has(flagName)) {
    return featureFlagCache.get(flagName) as FlagValue<T>;
  }
  // Return default value if not yet initialized
  const flagDef = goffFeatureFlags[flagName] as FeatureFlag;
  if ('value' in flagDef) {
    return flagDef.value as FlagValue<T>;
  }
  return flagDef.defaultValue as FlagValue<T>;
}

/**
 * Initializes all feature flags by evaluating them and caching the results.
 * Call this once during app initialization, after `initOpenFeatureProvider()`.
 */
export async function initializeFeatureFlags(): Promise<void> {
  await Promise.all(
    featureFlagNames.map(async (flagName) => {
      const value = await evaluateFeatureFlag(flagName);
      featureFlagCache.set(flagName, value);
    })
  );
}

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
    // OpenFeature initialization may fail in environments without the feature flag service (e.g., Grafana 11.6).
    // This is expected and the app will continue to work with config.featureToggles fallback or default flag values.
    logger.warn('OpenFeature provider initialization failed, using config.featureToggles fallback', {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

/**
 * Helper to wait for a client to be ready.
 * Rejects if the provider is in an error state or fails to initialize.
 */
function waitForClientReady(client: Client): Promise<void> {
  if (client.providerStatus === ClientProviderStatus.READY) {
    return Promise.resolve();
  }
  if (client.providerStatus === ClientProviderStatus.ERROR || client.providerStatus === ClientProviderStatus.FATAL) {
    return Promise.reject(new Error('OpenFeature provider failed to initialize'));
  }
  return new Promise((resolve, reject) => {
    client.addHandler(ProviderEvents.Ready, () => resolve());
    client.addHandler(ProviderEvents.Error, () => reject(new Error('OpenFeature provider error')));
  });
}

/**
 * Gets the default value from a feature flag definition.
 * Works for both core flags (value) and experiment flags (defaultValue).
 */
function getFlagDefaultValue(flagDef: FeatureFlag): boolean | number | string | JsonValue {
  if ('value' in flagDef) {
    return flagDef.value;
  }
  return flagDef.defaultValue;
}

/**
 * Gets a fallback value from config.featureToggles for flags that have equivalents there.
 * This is used when the OpenFeature provider fails to initialize (e.g., in older Grafana versions like 11.6).
 *
 * @param flagName - The name of the feature flag
 * @returns The value from config.featureToggles if available, undefined otherwise
 */
function getConfigToggleFallback(flagName: string): boolean | undefined {
  // Only exploreLogsAggregatedMetrics has a config.featureToggles equivalent
  if (flagName === 'exploreLogsAggregatedMetrics') {
    return config.featureToggles.exploreLogsAggregatedMetrics;
  }
  return undefined;
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
    // Check if the flag is a core flag or plugin-scoped flag
    const defaultValue = getFlagDefaultValue(flagDef);

    switch (flagDef.valueType) {
      case 'boolean':
        const booleanValue = client.getBooleanValue(flagName, defaultValue as boolean);
        return booleanValue as FlagValue<T>;
      case 'number':
        const numberValue = client.getNumberValue(flagName, defaultValue as number);
        return numberValue as FlagValue<T>;
      case 'object':
        const objectValue = client.getObjectValue(flagName, defaultValue as JsonValue);
        return objectValue as FlagValue<T>;
      case 'string':
        const stringValue = client.getStringValue(flagName, defaultValue as string);
        return stringValue as FlagValue<T>;
      default:
        throw new Error(`Invalid flag value type for flag ${flagName}`);
    }
  } catch (error) {
    // On any error, try config.featureToggles fallback first, then default value
    logger.error(new Error(`Error evaluating ${flagName} flag.`, { cause: error }));
    const configValue = getConfigToggleFallback(flagName);
    if (configValue !== undefined) {
      return configValue as FlagValue<T>;
    }
    const flagDef = goffFeatureFlags[flagName] as FeatureFlag;
    return getFlagDefaultValue(flagDef) as FlagValue<T>;
  }
}
