import semver from 'semver/preload';

import { config } from '@grafana/runtime';

import { getFeatureFlag } from '../../../featureFlags/openFeature';

const DEFAULT_COLUMNS_MIN_VERSION = '13.0.0-22957488878';
export const isDefaultLabelsVersionSupported = !semver.ltr(config.buildInfo.version, DEFAULT_COLUMNS_MIN_VERSION);
export const isDefaultLabelsFlagsSupported = () => getFeatureFlag('kubernetesLogsDrilldown');
export const isDefaultLabelsSupported = () => isDefaultLabelsFlagsSupported() && isDefaultLabelsVersionSupported;
