import React from 'react';

import { AdHocFilterWithLabels } from '@grafana/scenes';

import { isTimeLabelNode } from '../../../services/JSONVizNodes';
import { logsSyntaxMatches } from '../../../services/logsSyntaxMatches';
import { JsonDataFrameLabelsName, JsonDataFrameStructuredMetadataName } from '../LogsJsonScene';
import { highlightLineFilterMatches, highlightRegexMatches } from './highlightLineFilterMatches';
import { KeyPath } from '@gtk-grafana/react-json-tree/dist/types';

interface ValueRendererProps {
  keyPath: KeyPath;
  lineFilters: AdHocFilterWithLabels[];
  // @todo react-json-tree should probably return this type as string?
  valueAsString: unknown;
}

export default function ValueRenderer({ keyPath, lineFilters, valueAsString }: ValueRendererProps) {
  if (isTimeLabelNode(keyPath)) {
    return null;
  }
  const value = valueAsString?.toString();
  if (!value) {
    return null;
  }

  if (isParentNodeValid(keyPath)) {
    let valueArray = highlightLineFilterMatches(lineFilters, value);

    // If we have highlight matches we won't show syntax highlighting
    if (valueArray.length) {
      return valueArray.filter((e) => e);
    }
  }

  // Check syntax highlighting results
  let highlightedResults: Array<string | React.JSX.Element> = [];
  Object.keys(logsSyntaxMatches).some((key) => {
    const regex = value.match(logsSyntaxMatches[key]);
    if (regex) {
      highlightedResults = highlightRegexMatches([logsSyntaxMatches[key]], value, key);
      return true;
    }

    return false;
  });

  if (highlightedResults.length) {
    return highlightedResults;
  }

  return <>{value}</>;
}

const isParentNodeValid = (keyPath: KeyPath) => {
  return (
    keyPath[1] !== undefined &&
    keyPath[1] !== JsonDataFrameStructuredMetadataName &&
    keyPath[1] !== JsonDataFrameLabelsName
  );
};
