import React from 'react';

import { AdHocFilterWithLabels, SceneObject } from '@grafana/scenes';
import { Button, Icon } from '@grafana/ui';

import { JSONDataFrameLineName, JSONVizRootName } from '../JSONLogsScene';
import { KeyPath } from '@gtk-grafana/react-json-tree';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { clearJSONParserFields, isLogLineField } from 'services/fields';
import { addJsonParserFieldValue, EMPTY_AD_HOC_FILTER_VALUE, removeLineFormatFilters } from 'services/filters';
import { LineFormatFilterOp } from 'services/filterTypes';
import { breadCrumbDelimiter, drillUpWrapperStyle, itemStringDelimiter } from 'services/JSONViz';
import { LABEL_NAME_INVALID_CHARS } from 'services/labels';
import { addCurrentUrlToHistory } from 'services/navigate';
import { getFieldsVariable, getJSONFieldsVariable, getLineFormatVariable } from 'services/variableGetters';

interface Props {
  sceneRef: SceneObject;
}

/**
 * Gets re-root button and key label for root node when line format filter is active.
 * aka breadcrumbs
 */
export default function JSONRootNodeNavigation({ sceneRef }: Props) {
  const lineFormatVar = getLineFormatVariable(sceneRef);
  const filters = lineFormatVar.state.filters;
  const rootKeyPath = [JSONDataFrameLineName, 0, JSONVizRootName];

  return (
    <>
      <span className={drillUpWrapperStyle} key={JSONVizRootName}>
        <Button
          size={'sm'}
          onClick={() => setNewRootNode(rootKeyPath, sceneRef)}
          variant={'secondary'}
          fill={'outline'}
          disabled={!filters.length}
          name={JSONVizRootName}
        >
          {JSONVizRootName}
        </Button>
        {filters.length > 0 && <Icon className={breadCrumbDelimiter} name={'angle-right'} />}
      </span>

      {filters.map((filter, i) => {
        const selected = filter.key === filters[filters.length - 1].key;
        return (
          <span className={drillUpWrapperStyle} key={filter.key}>
            {
              <Button
                size={'sm'}
                disabled={selected}
                onClick={() => addDrillUp(filter.key, sceneRef)}
                variant={'secondary'}
                fill={'outline'}
              >
                {filter.key}
              </Button>
            }
            {i < filters.length - 1 && <Icon className={breadCrumbDelimiter} name={'angle-right'} />}
            {i === filters.length - 1 && <Icon className={itemStringDelimiter} name={'angle-right'} />}
          </span>
        );
      })}
    </>
  );
}

export function getFullKeyPath(
  keyPath: ReadonlyArray<string | number>,
  sceneObject: SceneObject
): { fullKeyPath: KeyPath; fullPathFilters: AdHocFilterWithLabels[] } {
  const lineFormatVar = getLineFormatVariable(sceneObject);

  const fullPathFilters: AdHocFilterWithLabels[] = [
    ...lineFormatVar.state.filters,
    ...keyPath
      // line format filters only store the parent node field names
      .filter((key) => typeof key === 'string' && !isLogLineField(key) && key !== JSONVizRootName)
      // keyPath order is from child to root, we want to order from root to child
      .reverse()
      // convert to ad-hoc filter
      .map((nodeKey) => ({
        key: nodeKey.toString(),
        // The operator and value are not used when interpolating the variable, but empty values will cause the ad-hoc filter to get removed from the URL state, we work around this by adding an empty space for the value and operator
        // we could store the depth of the node as a value, right now we assume that these filters always include every parent node of the current node, ordered by node depth ASC (root node first)
        operator: LineFormatFilterOp.Empty,
        value: EMPTY_AD_HOC_FILTER_VALUE,
      })),
  ];
  // the last 3 in the key path are always array
  const fullKeyPath = [...fullPathFilters.map((filter) => filter.key).reverse(), ...keyPath.slice(-3)];
  return { fullKeyPath, fullPathFilters };
}

export const setNewRootNode = (keyPath: KeyPath, sceneRef: SceneObject) => {
  addCurrentUrlToHistory();
  const { fullKeyPath, fullPathFilters } = getFullKeyPath(keyPath, sceneRef);
  // If keyPath length is greater than 3 we're drilling down (root, line index, line)
  if (keyPath.length > 3) {
    addJsonParserFieldValue(sceneRef, fullKeyPath);

    const lineFormatVar = getLineFormatVariable(sceneRef);

    lineFormatVar.setState({
      // Need to strip out any unsupported chars to match the field name we're creating in the json parser args
      filters: fullPathFilters.map((filter) => ({
        ...filter,
        key: filter.key.replace(LABEL_NAME_INVALID_CHARS, '_'),
      })),
    });
    lineFormatEvent('add', keyPath[0].toString());
  } else {
    // Otherwise we're drilling back up to the root
    removeLineFormatFilters(sceneRef);
    clearJSONParserFields(sceneRef);
    lineFormatEvent('remove', JSONVizRootName);
  }
};

/**
 * Fires rudderstack event when the viz adds/removes a new root (line format)
 */
export const lineFormatEvent = (type: 'add' | 'remove', key: string) => {
  reportAppInteraction(
    USER_EVENTS_PAGES.service_details,
    USER_EVENTS_ACTIONS.service_details.change_line_format_in_json_panel,
    {
      key,
      type: type,
    }
  );
};

/**
 * Drill back up to a parent node via the sticky "breadcrumbs"
 * @param key
 * @param sceneRef
 */
export const addDrillUp = (key: string, sceneRef: SceneObject) => {
  addCurrentUrlToHistory();

  const lineFormatVariable = getLineFormatVariable(sceneRef);
  const JSONVar = getJSONFieldsVariable(sceneRef);
  const fieldsVar = getFieldsVariable(sceneRef);

  const lineFormatFilters = lineFormatVariable.state.filters;
  const keyIndex = lineFormatFilters.findIndex((filter) => filter.key === key);
  const lineFormatFiltersToKeep = lineFormatFilters.filter((_, index) => index <= keyIndex);
  const JSONParserKeys: string[] = [];

  for (let i = 0; i < lineFormatFilters.length; i++) {
    JSONParserKeys.push(
      `${
        JSONParserKeys.length
          ? `${lineFormatFilters
              .map((filter) => filter.key)
              .slice(0, i)
              .join('_')}_`
          : ''
      }${lineFormatFilters[i].key}`
    );
  }

  const JSONParserKeysToRemove = JSONParserKeys.slice(keyIndex + 1);
  const fieldsFilterSet = new Set();
  fieldsVar.state.filters.forEach((fieldFilter) => fieldsFilterSet.add(fieldFilter.key));

  const JSONParserFilters = JSONVar.state.filters.filter(
    (filter) => !JSONParserKeysToRemove.includes(filter.key) || fieldsFilterSet.has(filter.key)
  );

  JSONVar.setState({
    filters: JSONParserFilters,
  });
  lineFormatVariable.setState({
    filters: lineFormatFiltersToKeep,
  });

  lineFormatEvent('remove', key);
};
