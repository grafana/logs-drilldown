import React from 'react';

import { AdHocFiltersVariable } from '@grafana/scenes';

import {
  getLineFilterMatches,
  getLineFilterRegExps,
  highlightValueStringMatches,
  logsSyntaxMatches,
  mergeOverlapping,
} from '../../../services/highlight';
import { JsonDataFrameLabelsName, JsonDataFrameStructuredMetadataName, JsonDataFrameTimeName } from '../LogsJsonScene';
import { KeyPath } from '@gtk-grafana/react-json-tree/dist/types';

interface ValueRendererProps {
  keyPath: KeyPath;
  lineFilterVar: AdHocFiltersVariable;
  valueAsString: unknown;
}

export default function ValueRenderer({ keyPath, lineFilterVar, valueAsString }: ValueRendererProps) {
  if (keyPath[0] === JsonDataFrameTimeName) {
    return null;
  }
  const value = valueAsString?.toString();
  if (!value) {
    return null;
  }

  const keyPathParent = keyPath[1];

  if (
    keyPathParent !== undefined &&
    keyPathParent !== JsonDataFrameStructuredMetadataName &&
    keyPathParent !== JsonDataFrameLabelsName
  ) {
    const matchExpressions = getLineFilterRegExps(lineFilterVar.state.filters);
    const lineFilterMatches = getLineFilterMatches(matchExpressions, value);
    const size = mergeOverlapping(lineFilterMatches);
    let valueArray: Array<React.JSX.Element | string> = [];

    if (lineFilterMatches.length) {
      valueArray = highlightValueStringMatches(lineFilterMatches, value, size);
    }

    // If we have highlight matches we won't show syntax highlighting
    if (valueArray.length) {
      return valueArray.filter((e) => e);
    }
  }

  // Check syntax highlighting results
  const matchKey = Object.keys(logsSyntaxMatches).find((key) => value.match(logsSyntaxMatches[key]));
  if (matchKey) {
    return <span className={matchKey}>{value}</span>;
  }

  return <>{value}</>;
}
