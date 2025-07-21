import React, { memo } from 'react';

import { AdHocFilterWithLabels } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { JSONHighlightLineFilterMatches } from '../../../services/JSONHighlightLineFilterMatches';
import { getJSONLabelWrapStyles } from '../../../services/JSONViz';
import { getKeyPathString, JSONLogsScene } from '../JSONLogsScene';
import { JSONNestedNodeFilterButton } from './JSONNestedNodeFilterButton';
import { getFullKeyPath } from './JSONRootNodeNavigation';
import ReRootJSONButton from './ReRootJSONButton';
import { KeyPath } from '@gtk-grafana/react-json-tree';
import { getJSONKey } from 'services/filters';
import { isOperatorExclusive, isOperatorInclusive } from 'services/operatorHelpers';
import { getValueFromFieldsFilter } from 'services/variableGetters';
import { EMPTY_VARIABLE_VALUE } from 'services/variables';

interface Props {
  fieldsFilters: AdHocFilterWithLabels[];
  JSONFiltersSupported: boolean | null;
  JSONLogsScene: JSONLogsScene;
  JSONParserPropsMap: Map<string, AdHocFilterWithLabels>;
  keyPath: KeyPath;
  lineFilters: AdHocFilterWithLabels[];
}

function NestedNodeFilterButtonsComponent({
  keyPath,
  fieldsFilters,
  JSONParserPropsMap,
  lineFilters,
  JSONFiltersSupported,
  JSONLogsScene,
}: Props) {
  const { fullKeyPath } = getFullKeyPath(keyPath, JSONLogsScene);
  const fullKey = getJSONKey(fullKeyPath);
  const styles = useStyles2(getJSONLabelWrapStyles);

  const JSONParserProp = JSONParserPropsMap.get(fullKey);
  const existingFilter =
    JSONParserProp &&
    fieldsFilters.find(
      (f) => f.key === JSONParserProp?.key && getValueFromFieldsFilter(f).value === EMPTY_VARIABLE_VALUE
    );

  let highlightedValue: string | Array<string | React.JSX.Element> = [];
  if (JSONLogsScene.state.hasHighlight) {
    highlightedValue = JSONHighlightLineFilterMatches(lineFilters, keyPath[0].toString());
  }

  return (
    <span className={styles.JSONNestedLabelWrapStyles}>
      {JSONFiltersSupported && (
        <>
          <ReRootJSONButton keyPath={keyPath} sceneRef={JSONLogsScene} />
          <JSONNestedNodeFilterButton
            type={'include'}
            fullKeyPath={fullKey}
            keyPath={fullKeyPath}
            active={existingFilter ? isOperatorExclusive(existingFilter.operator) : false}
            logsJsonScene={JSONLogsScene}
          />
          <JSONNestedNodeFilterButton
            type={'exclude'}
            fullKeyPath={fullKey}
            keyPath={fullKeyPath}
            active={existingFilter ? isOperatorInclusive(existingFilter.operator) : false}
            logsJsonScene={JSONLogsScene}
          />
        </>
      )}
      <strong className={styles.JSONLabelWrapStyles}>
        {highlightedValue.length ? highlightedValue : getKeyPathString(keyPath, '')}:
      </strong>
    </span>
  );
}

export const JSONParentNodeFilterButtons = memo(NestedNodeFilterButtonsComponent);
