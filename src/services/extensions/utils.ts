import { datasourceUrlKey } from '../../Components/ServiceSelectionScene/ServiceSelectionScene';
import { escapeUrlPipeDelimiters } from './links';
import { addAdHocFilterUserInputPrefix } from 'services/variables';

export function encodeFilter(input: string) {
  return encodeURIComponent(input)
    .replace(/!/g, '%21')
    .replace(/~/g, '%7E')
    .replace(/%20/g, '+')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

/**
 * Test helper method
 * Adds the custom input prefix
 * Adds the value to valueLabels
 */
export function addCustomInputPrefixAndValueLabels(value: string) {
  return `${escapeUrlPipeDelimiters(addAdHocFilterUserInputPrefix(value))},${escapeUrlPipeDelimiters(value)}`;
}

export function getPath(options: {
  expectedFieldsUrlString?: string;
  expectedLabelFiltersUrlString?: string;
  expectedLevelsFilterUrlString?: string;
  expectedLineFiltersUrlString?: string;
  expectedMetadataString?: string;
  expectedPatterns?: string;
  expectedPatternsVariable?: string;
  slug: string;
}) {
  return `/a/grafana-lokiexplore-app/explore/${
    options.slug
  }/logs?${datasourceUrlKey}=123abc&from=1675828800000&to=1675854000000${options.expectedLabelFiltersUrlString ?? ''}${
    options.expectedMetadataString ?? ''
  }${options.expectedLineFiltersUrlString ?? ''}${options.expectedPatterns ?? ''}${
    options.expectedPatternsVariable ?? ''
  }${options.expectedFieldsUrlString ?? ''}${options.expectedLevelsFilterUrlString ?? ''}`;
}
