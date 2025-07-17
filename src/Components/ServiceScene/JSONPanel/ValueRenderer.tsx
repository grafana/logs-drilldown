import React from 'react';

import { AdHocFilterWithLabels } from '@grafana/scenes';

import { hasFieldParentNode, isTimeLabelNode } from '../../../services/JSONVizNodes';
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

  // Don't bother rendering empty values
  if (!value) {
    return null;
  }

  // Link nodes
  if (keyPath[1] === JsonDataFrameLinksName) {
    return <JsonLinkButton payload={value} />;
  }

  // If highlighting is enabled, split up the value string into an array of React objects wrapping text that matches syntax regex or matches line filter regex
  if (model.state.showHighlight) {
    // Don't show line filter matches on field nodes
    if (!hasFieldParentNode(keyPath)) {
      let valueArray = highlightLineFilterMatches(lineFilters, value);

      // If we have highlight matches we won't show syntax highlighting
      if (valueArray.length) {
        return valueArray;
      }
    }

    // Check syntax highlighting results
    let highlightedResults: Array<string | React.JSX.Element> = [];

    // Only grab the first regex match from the logsSyntaxMatches object
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

  return value;
}
