import React from 'react';

import { AdHocFilterWithLabels } from '@grafana/scenes';

import { hasValidParentNode, isTimeLabelNode } from '../../../services/JSONVizNodes';
import { logsSyntaxMatches } from '../../../services/logsSyntaxMatches';
import { JsonDataFrameLinksName, LogsJsonScene } from '../LogsJsonScene';
import { highlightLineFilterMatches, highlightRegexMatches } from './highlightLineFilterMatches';
import JsonLinkButton from './JsonLinkButton';
import { KeyPath } from '@gtk-grafana/react-json-tree/dist/types';

interface ValueRendererProps {
  keyPath: KeyPath;
  lineFilters: AdHocFilterWithLabels[];
  model: LogsJsonScene;
  // @todo react-json-tree should probably return this type as string?
  valueAsString: unknown;
}

export default function ValueRenderer({ keyPath, lineFilters, valueAsString, model }: ValueRendererProps) {
  if (isTimeLabelNode(keyPath)) {
    return null;
  }
  const value = valueAsString?.toString();
  if (!value) {
    return null;
  }

  if (keyPath[1] === JsonDataFrameLinksName) {
    return <JsonLinkButton href={value} keyPath={keyPath} />;
  }

  if (hasValidParentNode(keyPath)) {
    let valueArray = highlightLineFilterMatches(lineFilters, value);

    // If we have highlight matches we won't show syntax highlighting
    if (valueArray.length) {
      return valueArray;
    }
  }

  if (model.state.showHighlight) {
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
  }

  return <>{value}</>;
}
