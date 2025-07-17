import React, { memo } from 'react';

import { AdHocFilterWithLabels } from '@grafana/scenes';

import { getJsonKey } from '../../../services/filters';
import { jsonLabelWrapStyles, jsonNestedLabelWrapStyles } from '../../../services/JSONViz';
import { isOperatorExclusive, isOperatorInclusive } from '../../../services/operatorHelpers';
import { getValueFromFieldsFilter } from '../../../services/variableGetters';
import { EMPTY_VARIABLE_VALUE } from '../../../services/variables';
import { LogsJsonScene } from '../LogsJsonScene';
import { highlightLineFilterMatches } from './highlightLineFilterMatches';
import { JSONFilterNestedNodeButton } from './JSONFilterNestedNodeButton';
import { getFullKeyPath } from './JsonRootNodeNavigation';
import ReRootJSONButton from './ReRootJSONButton';
import { KeyPath } from '@gtk-grafana/react-json-tree';

interface Props {
  fieldsFilters: AdHocFilterWithLabels[];
  jsonFiltersSupported?: boolean;
  jsonParserPropsMap: Map<string, AdHocFilterWithLabels>;
  keyPath: KeyPath;
  lineFilters: AdHocFilterWithLabels[];
  logsJsonScene: LogsJsonScene;
}

function NestedNodeFilterButtonsComponent({
  keyPath,
  fieldsFilters,
  jsonParserPropsMap,
  lineFilters,
  jsonFiltersSupported,
  logsJsonScene,
}: Props) {
  const { fullKeyPath } = getFullKeyPath(keyPath, logsJsonScene);
  const fullKey = getJsonKey(fullKeyPath);

  const jsonParserProp = jsonParserPropsMap.get(fullKey);
  const existingFilter =
    jsonParserProp &&
    fieldsFilters.find(
      (f) => f.key === jsonParserProp?.key && getValueFromFieldsFilter(f).value === EMPTY_VARIABLE_VALUE
    );

  let highlightedValue: string | Array<string | React.JSX.Element> = [];
  if (logsJsonScene.state.showHighlight) {
    highlightedValue = highlightLineFilterMatches(lineFilters, keyPath[0].toString());
  }

  return (
    <span className={jsonNestedLabelWrapStyles}>
      {jsonFiltersSupported && (
        <>
          <ReRootJSONButton keyPath={keyPath} sceneRef={logsJsonScene} />
          <JSONFilterNestedNodeButton
            type={'include'}
            fullKeyPath={fullKey}
            keyPath={fullKeyPath}
            active={existingFilter ? isOperatorExclusive(existingFilter.operator) : false}
            logsJsonScene={logsJsonScene}
          />
          <JSONFilterNestedNodeButton
            type={'exclude'}
            fullKeyPath={fullKey}
            keyPath={fullKeyPath}
            active={existingFilter ? isOperatorInclusive(existingFilter.operator) : false}
            logsJsonScene={logsJsonScene}
          />
        </>
      )}
      <strong className={jsonLabelWrapStyles}>
        {highlightedValue.length ? highlightedValue : logsJsonScene.getKeyPathString(keyPath, '')}:
      </strong>
    </span>
  );
}

export const NestedNodeFilterButtons = memo(NestedNodeFilterButtonsComponent);
