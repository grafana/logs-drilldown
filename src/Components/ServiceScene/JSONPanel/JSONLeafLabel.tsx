import React from 'react';

import { Field } from '@grafana/data';
import { AdHocFiltersVariable, AdHocFilterWithLabels } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { JSONHighlightLineFilterMatches } from '../../../services/JSONHighlightLineFilterMatches';
import { InterpolatedFilterType } from '../Breakdowns/AddToFiltersButton';
import {
  getKeyPathString,
  JSONDataFrameLabelsName,
  JSONDataFrameStructuredMetadataName,
  JSONLogsScene,
  JSONVizRootName,
} from '../JSONLogsScene';
import { JSONLabelText } from './JSONLabelText';
import { JSONLeafNodeLabelButtons } from './JSONLeafNodeLabelButtons';
import { JSONMetadataButtons } from './JSONMetadataButtons';
import { getFullKeyPath } from './JSONRootNodeNavigation';
import { KeyPath } from '@gtk-grafana/react-json-tree';
import { getJSONKey } from 'services/filters';
import { getJSONLabelWrapStyles, getJSONVizNestedProperty } from 'services/JSONViz';
import { hasFieldParentNode } from 'services/JSONVizNodes';
import { getAdHocFiltersVariable, getValueFromFieldsFilter } from 'services/variableGetters';
import { LEVEL_VARIABLE_VALUE, VAR_FIELDS, VAR_LABELS, VAR_LEVELS, VAR_METADATA } from 'services/variables';

interface Props {
  fieldsVar: AdHocFiltersVariable;
  JSONFiltersSupported: boolean | null;
  JSONLogsScene: JSONLogsScene;
  JSONParserPropsMap: Map<string, AdHocFilterWithLabels>;
  keyPath: KeyPath;
  lineField: Field<string | number>;
  lineFilters: AdHocFilterWithLabels[];
}

export function JSONLeafLabel({
  keyPath,
  lineField,
  fieldsVar,
  JSONParserPropsMap,
  lineFilters,
  JSONFiltersSupported,
  JSONLogsScene,
}: Props) {
  const value = getValue(keyPath, lineField.values)?.toString();
  const label = keyPath[0];
  const existingVariableType = getFilterVariableTypeFromPath(keyPath);
  const styles = useStyles2(getJSONLabelWrapStyles);

  let highlightedValue: string | Array<string | React.JSX.Element> = [];
  if (JSONLogsScene.state.hasHighlight && !hasFieldParentNode(keyPath)) {
    highlightedValue = JSONHighlightLineFilterMatches(lineFilters, keyPath[0].toString());
  }

  // Field (labels, metadata) nodes
  if (hasFieldParentNode(keyPath)) {
    const existingVariable = getAdHocFiltersVariable(existingVariableType, JSONLogsScene);
    const existingFilter = existingVariable.state.filters.filter(
      (filter) => filter.key === label.toString() && filter.value === value
    );

    return (
      <span className={styles.labelButtonsWrap}>
        <JSONMetadataButtons
          sceneRef={JSONLogsScene}
          label={label}
          value={value}
          variableType={existingVariableType}
          existingFilter={existingFilter}
        />
        <JSONLabelText text={highlightedValue} keyPathString={getKeyPathString(keyPath, '')} />
      </span>
    );
  }

  const { fullKeyPath } = getFullKeyPath(keyPath, JSONLogsScene);
  const fullKey = getJSONKey(fullKeyPath);
  const JSONParserProp = JSONParserPropsMap.get(fullKey);
  const existingJSONFilter =
    JSONParserProp &&
    fieldsVar.state.filters.find((f) => f.key === JSONParserProp?.key && getValueFromFieldsFilter(f).value === value);

  // Value nodes
  return (
    <span className={styles.labelButtonsWrap}>
      {JSONFiltersSupported && (
        <JSONLeafNodeLabelButtons
          JSONFiltersSupported={JSONFiltersSupported}
          label={label}
          value={value}
          fullKeyPath={fullKeyPath}
          fullKey={fullKey}
          existingFilter={existingJSONFilter}
          elements={highlightedValue}
          keyPathString={getKeyPathString(keyPath, '')}
          model={JSONLogsScene}
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

    if (key !== JSONVizRootName && key !== undefined) {
      accessors.push(key);
    }
  }

  return getJSONVizNestedProperty(lineField, accessors);
}

function getFilterVariableTypeFromPath(keyPath: ReadonlyArray<string | number>): InterpolatedFilterType {
  if (keyPath[1] === JSONDataFrameStructuredMetadataName) {
    if (keyPath[0] === LEVEL_VARIABLE_VALUE) {
      return VAR_LEVELS;
    }
    return VAR_METADATA;
  } else if (keyPath[1] === JSONDataFrameLabelsName) {
    return VAR_LABELS;
  } else {
    return VAR_FIELDS;
  }
}
