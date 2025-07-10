import { AdHocFilterWithLabels } from '@grafana/scenes';

import {
  getLineFilterRegExps,
  getMatchingIntervals,
  highlightValueStringMatches,
  mergeOverlapping,
  TextWithHighlightedValue,
} from '../../../services/highlight';

export function highlightLineFilterMatches(lineFilters: AdHocFilterWithLabels[], value: string, className?: string) {
  const matchExpressions = getLineFilterRegExps(lineFilters);
  const lineFilterMatches = getMatchingIntervals(matchExpressions, value);
  const size = mergeOverlapping(lineFilterMatches);
  let valueArray: TextWithHighlightedValue = [];

  if (lineFilterMatches.length) {
    valueArray = highlightValueStringMatches(lineFilterMatches, value, size, className);
  }
  return valueArray;
}

export function highlightRegexMatches(regex: RegExp[], value: string, className: string) {
  const lineFilterMatches = getMatchingIntervals(regex, value);
  const size = mergeOverlapping(lineFilterMatches);
  let valueArray: TextWithHighlightedValue = [];

  if (lineFilterMatches.length) {
    valueArray = highlightValueStringMatches(lineFilterMatches, value, size, className);
  }
  return valueArray;
}
