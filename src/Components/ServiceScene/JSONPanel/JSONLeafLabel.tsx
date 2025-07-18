import React from 'react';

import { Field } from '@grafana/data';
import { AdHocFiltersVariable, AdHocFilterWithLabels } from '@grafana/scenes';

import { JSONHighlightLineFilterMatches } from '../../../services/JSONHighlightLineFilterMatches';
import { InterpolatedFilterType } from '../Breakdowns/AddToFiltersButton';
import {
  getKeyPathString,
  JsonDataFrameLabelsName,
  JsonDataFrameStructuredMetadataName,
  JSONLogsScene,
  JsonVizRootName,
} from '../JSONLogsScene';
import { JSONLabelText } from './JSONLabelText';
import { JSONLeafNodeLabelButtons } from './JSONLeafNodeLabelButtons';
import { JSONMetadataButtons } from './JSONMetadataButtons';
import { getFullKeyPath } from './JSONRootNodeNavigation';
import { KeyPath } from '@gtk-grafana/react-json-tree';
import { getJsonKey } from 'services/filters';
import { addJsonFieldFilter } from 'services/JSONFilter';
import { getJSONVizNestedProperty, jsonLabelButtonsWrapStyle } from 'services/JSONViz';
import { hasFieldParentNode } from 'services/JSONVizNodes';
import { getAdHocFiltersVariable, getValueFromFieldsFilter } from 'services/variableGetters';
import { LEVEL_VARIABLE_VALUE, VAR_FIELDS, VAR_LABELS, VAR_LEVELS, VAR_METADATA } from 'services/variables';

interface Props {
  fieldsVar: AdHocFiltersVariable;
  jsonFiltersSupported?: boolean;
  jsonParserPropsMap: Map<string, AdHocFilterWithLabels>;
  keyPath: KeyPath;
  lineField: Field<string | number>;
  lineFilters: AdHocFilterWithLabels[];
  logsJsonScene: JSONLogsScene;
}

export function JSONLeafLabel({
  keyPath,
  lineField,
  fieldsVar,
  jsonParserPropsMap,
  lineFilters,
  jsonFiltersSupported,
  logsJsonScene,
}: Props) {
  const value = getValue(keyPath, lineField.values)?.toString();
  const label = keyPath[0];
  const existingVariableType = getFilterVariableTypeFromPath(keyPath);

  let highlightedValue: string | Array<string | React.JSX.Element> = [];
  if (logsJsonScene.state.showHighlight && !hasFieldParentNode(keyPath)) {
    highlightedValue = JSONHighlightLineFilterMatches(lineFilters, keyPath[0].toString());
  }

  // Field (labels, metadata) nodes
  if (hasFieldParentNode(keyPath)) {
    const existingVariable = getAdHocFiltersVariable(existingVariableType, logsJsonScene);
    const existingFilter = existingVariable.state.filters.filter(
      (filter) => filter.key === label.toString() && filter.value === value
    );

    return (
      <span className={jsonLabelButtonsWrapStyle}>
        <JSONMetadataButtons
          sceneRef={logsJsonScene}
          label={label}
          value={value}
          variableType={existingVariableType}
          addJsonFilter={addJsonFieldFilter}
          existingFilter={existingFilter}
        />
        <JSONLabelText text={highlightedValue} keyPathString={getKeyPathString(keyPath, '')} />
      </span>
    );
  }

  const { fullKeyPath } = getFullKeyPath(keyPath, logsJsonScene);
  const fullKey = getJsonKey(fullKeyPath);
  const jsonParserProp = jsonParserPropsMap.get(fullKey);
  const existingJsonFilter =
    jsonParserProp &&
    fieldsVar.state.filters.find((f) => f.key === jsonParserProp?.key && getValueFromFieldsFilter(f).value === value);

  // Value nodes
  return (
    <span className={jsonLabelButtonsWrapStyle}>
      {jsonFiltersSupported && (
        <JSONLeafNodeLabelButtons
          jsonFiltersSupported={jsonFiltersSupported}
          label={label}
          value={value}
          fullKeyPath={fullKeyPath}
          fullKey={fullKey}
          addJsonFilter={addJsonFieldFilter}
          existingFilter={existingJsonFilter}
          elements={highlightedValue}
          keyPathString={getKeyPathString(keyPath, '')}
          model={logsJsonScene}
        />
      )}
      <JSONLabelText text={highlightedValue} keyPathString={getKeyPathString(keyPath, '')} />
    </span>
  );
}

/**
 * Gets value from log Field at keyPath
 */
function getValue(keyPath: KeyPath, lineField: Array<string | number>): string | number {
  const keys = [...keyPath];
  const accessors = [];

  while (keys.length) {
    const key = keys.pop();

    if (key !== JsonVizRootName && key !== undefined) {
      accessors.push(key);
    }
  }

  return getJSONVizNestedProperty(lineField, accessors);
}

function getFilterVariableTypeFromPath(keyPath: ReadonlyArray<string | number>): InterpolatedFilterType {
  if (keyPath[1] === JsonDataFrameStructuredMetadataName) {
    if (keyPath[0] === LEVEL_VARIABLE_VALUE) {
      return VAR_LEVELS;
    }
    return VAR_METADATA;
  } else if (keyPath[1] === JsonDataFrameLabelsName) {
    return VAR_LABELS;
  } else {
    return VAR_FIELDS;
  }
}
