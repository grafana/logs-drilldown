import React, { memo } from 'react';

import { AdHocFilterWithLabels } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { JSONHighlightLineFilterMatches } from '../../../services/JSONHighlightLineFilterMatches';
import { getJsonLabelWrapStyles } from '../../../services/JSONViz';
import { getKeyPathString, JSONLogsScene } from '../JSONLogsScene';
import { JSONNestedNodeFilterButton } from './JSONNestedNodeFilterButton';
import { getFullKeyPath } from './JSONRootNodeNavigation';
import ReRootJSONButton from './ReRootJSONButton';
import { KeyPath } from '@gtk-grafana/react-json-tree';
import { getJsonKey } from 'services/filters';
import { isOperatorExclusive, isOperatorInclusive } from 'services/operatorHelpers';
import { getValueFromFieldsFilter } from 'services/variableGetters';
import { EMPTY_VARIABLE_VALUE } from 'services/variables';

interface Props {
  fieldsFilters: AdHocFilterWithLabels[];
  jsonFiltersSupported?: boolean;
  jsonParserPropsMap: Map<string, AdHocFilterWithLabels>;
  keyPath: KeyPath;
  lineFilters: AdHocFilterWithLabels[];
  logsJsonScene: JSONLogsScene;
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
  const styles = useStyles2(getJsonLabelWrapStyles);

  const jsonParserProp = jsonParserPropsMap.get(fullKey);
  const existingFilter =
    jsonParserProp &&
    fieldsFilters.find(
      (f) => f.key === jsonParserProp?.key && getValueFromFieldsFilter(f).value === EMPTY_VARIABLE_VALUE
    );

  let highlightedValue: string | Array<string | React.JSX.Element> = [];
  if (logsJsonScene.state.showHighlight) {
    highlightedValue = JSONHighlightLineFilterMatches(lineFilters, keyPath[0].toString());
  }

  return (
    <span className={styles.jsonNestedLabelWrapStyles}>
      {jsonFiltersSupported && (
        <>
          <ReRootJSONButton keyPath={keyPath} sceneRef={logsJsonScene} />
          <JSONNestedNodeFilterButton
            type={'include'}
            fullKeyPath={fullKey}
            keyPath={fullKeyPath}
            active={existingFilter ? isOperatorExclusive(existingFilter.operator) : false}
            logsJsonScene={logsJsonScene}
          />
          <JSONNestedNodeFilterButton
            type={'exclude'}
            fullKeyPath={fullKey}
            keyPath={fullKeyPath}
            active={existingFilter ? isOperatorInclusive(existingFilter.operator) : false}
            logsJsonScene={logsJsonScene}
          />
        </>
      )}
      <strong className={styles.jsonLabelWrapStyles}>
        {highlightedValue.length ? highlightedValue : getKeyPathString(keyPath, '')}:
      </strong>
    </span>
  );
}

export const JSONParentNodeFilterButtons = memo(NestedNodeFilterButtonsComponent);
