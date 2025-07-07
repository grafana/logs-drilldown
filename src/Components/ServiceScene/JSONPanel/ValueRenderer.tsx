import React from 'react';

import { AdHocFilterWithLabels } from '@grafana/scenes';

import { logsSyntaxMatches } from '../../../services/highlight';
import { JsonDataFrameLabelsName, JsonDataFrameStructuredMetadataName, JsonDataFrameTimeName } from '../LogsJsonScene';
import { highlightLineFilterMatches } from './highlightLineFilterMathces';
import { KeyPath } from '@gtk-grafana/react-json-tree/dist/types';

interface ValueRendererProps {
  keyPath: KeyPath;
  lineFilters: AdHocFilterWithLabels[];
  valueAsString: unknown;
}

export default function ValueRenderer({ keyPath, lineFilters, valueAsString }: ValueRendererProps) {
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
    let valueArray = highlightLineFilterMatches(lineFilters, value);

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
