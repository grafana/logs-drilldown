import React from 'react';

import { AdHocFilterWithLabels } from '@grafana/scenes';

import {
  getLineFilterMatches,
  getLineFilterRegExps,
  highlightValueStringMatches,
  mergeOverlapping,
} from '../../../services/highlight';

export function highlightLineFilterMatches(lineFilters: AdHocFilterWithLabels[], value: string) {
  const matchExpressions = getLineFilterRegExps(lineFilters);
  const lineFilterMatches = getLineFilterMatches(matchExpressions, value);
  const size = mergeOverlapping(lineFilterMatches);
  let valueArray: Array<React.JSX.Element | string> = [];

  if (lineFilterMatches.length) {
    valueArray = highlightValueStringMatches(lineFilterMatches, value, size);
  }
  return valueArray;
}
