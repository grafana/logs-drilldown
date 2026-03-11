import semver from 'semver/preload';

import { config } from '@grafana/runtime';

const DEFAULT_COLUMNS_MIN_VERSION = '13.0.0-22957488878';
export const isDefaultLabelsVersionSupported = !semver.ltr(config.buildInfo.version, DEFAULT_COLUMNS_MIN_VERSION);
export const isDefaultLabelsFlagsSupported = config.featureToggles.kubernetesLogsDrilldown;
export const isDefaultLabelsSupported = isDefaultLabelsFlagsSupported && isDefaultLabelsVersionSupported;
