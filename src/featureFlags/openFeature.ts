import { OpenFeature, MultiProvider, type JsonValue } from '@openfeature/web-sdk';

import { createOpenFeatureLocalStorageProvider, createOpenFeatureOFREPWebProvider } from '@grafana/runtime';

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
  Values extends ReadonlyArray<ValueTypeMap[VT]> = ReadonlyArray<ValueTypeMap[VT]>,
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
type WidenPrimitive<T> = T extends boolean ? boolean : T extends number ? number : T extends string ? string : T;
type GetFlagDefault<F> = F extends { value: infer V }
  ? WidenPrimitive<V>
  : F extends { defaultValue: infer D }
    ? WidenPrimitive<D>
    : never;

/**
 * All Logs Drilldown feature flags that we intend to use from the GoFF service are defined here.
 * {@link https://github.com/grafana/deployment_tools/blob/master/ksonnet/environments/hosted-grafana/waves/feature-toggles/goff/drilldown/logs/flag-definitions.libsonnet} for the source of truth.
 * Core feature flags are defined in the {@link https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/types/featureToggles.gen.ts} file.
 */
const goffFeatureFlags = {
  kubernetesLogsDrilldown: {
    valueType: 'boolean',
    value: false,
    reason: 'static provider evaluation result',
    variant: 'default',
  },
  otelLogsFormatting: {
    valueType: 'boolean',
    value: false,
    reason: 'static provider evaluation result',
    variant: 'default',
  },
  queryLibrary: {
    valueType: 'boolean',
    value: false,
    reason: 'static provider evaluation result',
    variant: 'default',
  },
  exploreLogsAggregatedMetrics: {
    valueType: 'boolean',
    value: false,
    reason: 'static provider evaluation result',
    variant: 'default',
  },
  exploreLogsShardSplitting: {
    valueType: 'boolean',
    value: false,
    reason: 'static provider evaluation result',
    variant: 'default',
  },
  'drilldown.logs.kgAnnotationsInLokiExplore': {
    valueType: 'boolean',
    value: false,
    reason: 'static provider evaluation result',
    variant: 'default',
  },
  'drilldown.logs.logsVolumeByField': {
    valueType: 'boolean',
    value: false,
    reason: 'static provider evaluation result',
    variant: 'default',
  },
  logsTablePanelNG: {
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
 * Evaluates a feature flag using the OpenFeature client.
 *
 * @param flagName - The name of the feature flag
 * @returns The evaluated flag value, or its default when the provider is not ready
 */
export function getFeatureFlag<T extends FeatureFlagName>(flagName: T): FlagValue<T> {
  const client = OpenFeature.getClient(OPEN_FEATURE_DOMAIN);
  client.addHooks(new TrackingHook());

  const flagDef = goffFeatureFlags[flagName] as FeatureFlag;
  const defaultValue = getFlagDefaultValue(flagDef);

  switch (flagDef.valueType) {
    case 'boolean':
      return client.getBooleanValue(flagName, defaultValue as boolean) as FlagValue<T>;
    case 'number':
      return client.getNumberValue(flagName, defaultValue as number) as FlagValue<T>;
    case 'object':
      return client.getObjectValue(flagName, defaultValue as JsonValue) as FlagValue<T>;
    case 'string':
      return client.getStringValue(flagName, defaultValue as string) as FlagValue<T>;
    default:
      throw new Error(`Invalid flag value type for flag ${flagName}`);
  }
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
  if (OpenFeature.getProvider(OPEN_FEATURE_DOMAIN) === OpenFeature.getProvider()) {
    return OpenFeature.setProviderAndWait(
      OPEN_FEATURE_DOMAIN,
      new MultiProvider([
        { provider: createOpenFeatureLocalStorageProvider() },
        { provider: createOpenFeatureOFREPWebProvider() },
      ])
    ).catch((error) => {
      // OpenFeature initialization may fail in environments without the feature flag service (e.g., Grafana 11.6).
      // This is expected and the app will continue to work with default flag values.
      logger.warn('OpenFeature provider initialization failed, using default flag values', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  return Promise.resolve();
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
