import type { EvaluationDetails, FlagValue, Hook, HookContext } from '@openfeature/web-sdk';

import { config } from '@grafana/runtime';

import { featureFlagTrackingKeys, type FlagTrackingKey } from './openFeature';

export const TRACKED_FLAG_VALUES: Record<FlagTrackingKey, unknown> = {
  experiment_aggregated_metrics: null,
};

/**
 * A hook that tracks feature flag evaluations and stores the flag value in module scope.
 * This is used to report the flag value in analytics interactions.
 */
export class TrackingHook implements Hook {
  constructor() {}

  after(hookContext: HookContext, evaluationDetails: EvaluationDetails<FlagValue>): void {
    if (!featureFlagTrackingKeys[hookContext.flagKey]) {
      return;
    }

    // For tracking, all we need to do is store the flag value in module scope.
    // We'll use this value later when reporting corresponding interactions.
    TRACKED_FLAG_VALUES[featureFlagTrackingKeys[hookContext.flagKey]] = evaluationDetails.value;
  }
}

/**
 * Returns the analytics payload for a tracked feature flag, optionally including the open feature context.
 *
 * @param flagTrackingKey - The `trackingKey` of the feature flag to track, as defined in the `goffFeatureFlags` object.
 * @param addOpenFeatureContext - Whether to include the open feature context in the payload.
 * @returns The analytics payload for the tracked flag, as a record with the flag tracking key as the key and the flag value as the value.
 */
export function getTrackedFlagPayload(
  flagTrackingKey: FlagTrackingKey,
  addOpenFeatureContext = false
): Partial<Record<FlagTrackingKey, unknown>> | null {
  const trackedFlagItem = TRACKED_FLAG_VALUES[flagTrackingKey];

  if (!trackedFlagItem) {
    return null;
  }

  return {
    [flagTrackingKey]: trackedFlagItem,
    ...(addOpenFeatureContext ? config.openFeatureContext : {}),
  };
}
