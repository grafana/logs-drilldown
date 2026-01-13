import semver from 'semver/preload';

import { config } from '@grafana/runtime';

const DEFAULT_COLUMNS_MIN_VERSION = '12.4.0-20854440429';
export const isDefaultColumnsVersionSupported = !semver.ltr(config.buildInfo.version, DEFAULT_COLUMNS_MIN_VERSION);
export const isDefaultColumnsFlagsSupported = config.featureToggles.kubernetesLogsDrilldown;
export const isDefaultColumnsSupported = isDefaultColumnsFlagsSupported && isDefaultColumnsVersionSupported;
