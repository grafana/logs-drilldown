import React, { useCallback, useRef } from 'react';

import { css } from '@emotion/css';
import { isNumber } from 'lodash';

import { Field, FieldType, GrafanaTheme2 } from '@grafana/data';
import { AdHocFiltersVariable, AdHocFilterWithLabels, SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { Alert, Badge, PanelChrome, useStyles2 } from '@grafana/ui';

import { isLogLineField } from '../../services/fields';
import {
  getLineFilterMatches,
  getLineFilterRegExps,
  getLogsHighlightStyles,
  highlightValueStringMatches,
  logsSyntaxMatches,
  mergeOverlapping,
} from '../../services/highlight';
import { rootNodeItemString } from '../../services/JSONViz';
import { hasProp } from '../../services/narrowing';
import { setJsonHighlightVisibility, setJsonLabelsVisibility, setJsonMetadataVisibility } from '../../services/store';
import { getFieldsVariable, getJsonFieldsVariable, getLineFiltersVariable } from '../../services/variableGetters';
import { LogsPanelHeaderActions } from '../Table/LogsHeaderActions';
import { NoMatchingLabelsScene } from './Breakdowns/NoMatchingLabelsScene';
import { LogListControls } from './LogListControls';
import {
  JsonDataFrameLabelsName,
  JsonDataFrameStructuredMetadataName,
  JsonDataFrameTimeName,
  JsonVizRootName,
  LabelsDisplayName,
  LogsJsonScene,
  NodeTypeLoc,
  StructuredMetadataDisplayName,
} from './LogsJsonScene';
import { LogsListScene } from './LogsListScene';
import { getLogsPanelFrame } from './ServiceScene';
import { JSONTree } from '@gtk-grafana/react-json-tree';
import { GetItemString, LabelRenderer, ValueRenderer } from '@gtk-grafana/react-json-tree/dist/types';

export function LogsJsonComponent({ model }: SceneComponentProps<LogsJsonScene>) {
  const {
    data,
    emptyScene,
    hasJsonFields,
    jsonFiltersSupported,
    menu,
    showHighlight,
    showLabels,
    showMetadata,
    sortOrder,
  } = model.useState();
  const $data = sceneGraph.getData(model);
  // Rerender on data change
  $data.useState();
  const logsListScene = sceneGraph.getAncestor(model, LogsListScene);
  const { visualizationType } = logsListScene.useState();
  const styles = useStyles2((t) => getStyles(t, showHighlight));

  const fieldsVar = getFieldsVariable(model);
  const jsonVar = getJsonFieldsVariable(model);

  // If we have a line format variable, we are drilled down into a nested node
  const dataFrame = getLogsPanelFrame(data);
  const lineField = dataFrame?.fields.find((field) => field.type === FieldType.string && isLogLineField(field.name));
  const jsonParserPropsMap = new Map<string, AdHocFilterWithLabels>();
  const lineFilterVar = getLineFiltersVariable(model);

  jsonVar.state.filters.forEach((filter) => {
    // @todo this should probably be set in the AdHocFilterWithLabels valueLabels array
    // all json props are wrapped with [\" ... "\], strip those chars out so we have the actual key used in the json
    const fullKeyFromJsonParserProps = filter.value
      .substring(3, filter.value.length - 3)
      .split('\\"][\\"')
      .join('_');
    jsonParserPropsMap.set(fullKeyFromJsonParserProps, filter);
  });
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const onScrollToBottomClick = useCallback(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, []);

  const onScrollToTopClick = useCallback(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, []);

  const onToggleStructuredMetadataClick = useCallback(
    (visible: boolean) => {
      model.setState({ showMetadata: visible });
      setJsonMetadataVisibility(visible);
    },
    [model]
  );

  const onToggleLabelsClick = useCallback(
    (visible: boolean) => {
      model.setState({ showLabels: visible });
      setJsonLabelsVisibility(visible);
    },
    [model]
  );

  const onToggleHighlightClick = useCallback(
    (visible: boolean) => {
      model.setState({ showHighlight: visible });
      setJsonHighlightVisibility(visible);
    },
    [model]
  );

  return (
    // @ts-expect-error todo: fix this when https://github.com/grafana/grafana/issues/103486 is done
    <PanelChrome
      padding={'none'}
      showMenuAlways={true}
      statusMessage={$data.state.data?.errors?.[0].message}
      loadingState={$data.state.data?.state}
      title={
        <>
          JSON <Badge color={'blue'} text={'Experimental'} />
        </>
      }
      menu={menu ? <menu.Component model={menu} /> : undefined}
      actions={<LogsPanelHeaderActions vizType={visualizationType} onChange={logsListScene.setVisualizationType} />}
    >
      <div className={styles.container}>
        {lineField?.values && lineField?.values.length > 0 && (
          <LogListControls
            showHighlight={showHighlight}
            onToggleHighlightClick={onToggleHighlightClick}
            showMetadata={showMetadata}
            onToggleStructuredMetadataClick={onToggleStructuredMetadataClick}
            showLabels={showLabels}
            onToggleLabelsClick={onToggleLabelsClick}
            sortOrder={sortOrder}
            onSortOrderChange={model.handleSortChange}
            onScrollToBottomClick={onScrollToBottomClick}
            onScrollToTopClick={onScrollToTopClick}
          />
        )}
        {dataFrame && lineField?.values && lineField?.values.length > 0 && (
          <div className={styles.JSONTreeWrap} ref={scrollRef}>
            {jsonFiltersSupported === false && (
              <Alert severity={'warning'} title={'JSON filtering requires Loki 3.5.0.'}>
                This view will be read only until Loki is upgraded to 3.5.0
              </Alert>
            )}
            {lineField.values.length > 0 && hasJsonFields === false && (
              <>
                <Alert severity={'info'} title={'No JSON fields detected'}>
                  This view is built for JSON log lines, but none were detected. Switch to the Logs or Table view for a
                  better experience.
                </Alert>
              </>
            )}
            <JSONTree
              data={lineField.values}
              hideRootExpand={true}
              valueWrap={''}
              getItemString={getItemString}
              valueRenderer={getValueRenderer(lineFilterVar)}
              shouldExpandNodeInitially={(_, __, level) => level <= 2}
              labelRenderer={getLabelRenderer(model, jsonFiltersSupported, lineField, fieldsVar, jsonParserPropsMap)}
            />
          </div>
        )}
        {emptyScene && lineField?.values.length === 0 && <NoMatchingLabelsScene.Component model={emptyScene} />}
      </div>
    </PanelChrome>
  );
}
LogsJsonComponent.displayName = 'Json.LogsJsonComponent';

const getItemString: GetItemString = (_, data, itemType, itemString, keyPath) => {
  if (data && hasProp(data, JsonDataFrameTimeName) && typeof data.Time === 'string') {
    return null;
  }
  if (keyPath[0] === JsonVizRootName) {
    return (
      <span className={rootNodeItemString}>
        {itemType} {itemString}
      </span>
    );
  }

  return <span>{itemType}</span>;
};

const getValueRenderer = (lineFilterVar: AdHocFiltersVariable): ValueRenderer => {
  const ValueComponent: ValueRenderer = (valueAsString, _, keyPath, keyPathParent) => {
    if (keyPath === JsonDataFrameTimeName) {
      return null;
    }
    const value = valueAsString?.toString();
    if (!value) {
      return null;
    }

    if (
      keyPathParent !== undefined &&
      keyPathParent !== JsonDataFrameStructuredMetadataName &&
      keyPathParent !== JsonDataFrameLabelsName
    ) {
      const matchExpressions = getLineFilterRegExps(lineFilterVar.state.filters);
      const lineFilterMatches = getLineFilterMatches(matchExpressions, value);
      const size = mergeOverlapping(lineFilterMatches);
      let valueArray: Array<React.JSX.Element | string> = [];

      if (lineFilterMatches.length) {
        valueArray = highlightValueStringMatches(lineFilterMatches, value, size);
      }

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
  };
  // @ts-expect-error eslint complains if there is no display name, but typescript complains if there is a display name...
  ValueComponent.displayName = 'Json.ValueRenderer';
  return ValueComponent;
};

const getLabelRenderer = (
  model: LogsJsonScene,
  jsonFiltersSupported: boolean | undefined,
  lineField: Field,
  fieldsVar: AdHocFiltersVariable,
  jsonParserPropsMap: Map<string, AdHocFilterWithLabels>
): LabelRenderer => {
  const LabelRendererComponent: LabelRenderer = (keyPath, nodeType) => {
    const nodeTypeLoc = nodeType as NodeTypeLoc;
    if (keyPath[0] === JsonDataFrameStructuredMetadataName) {
      return StructuredMetadataDisplayName;
    }
    if (keyPath[0] === JsonDataFrameLabelsName) {
      return LabelsDisplayName;
    }

    if (keyPath[0] === JsonVizRootName) {
      return model.renderNestedNodeButtons(keyPath, jsonFiltersSupported);
    }

    // Value nodes
    if (
      nodeTypeLoc !== 'Object' &&
      nodeTypeLoc !== 'Array' &&
      keyPath[0] !== JsonDataFrameTimeName &&
      !isLogLineField(keyPath[0].toString()) &&
      keyPath[0] !== JsonVizRootName &&
      !isNumber(keyPath[0])
    ) {
      return model.renderValueLabel(keyPath, lineField, fieldsVar, jsonParserPropsMap, jsonFiltersSupported);
    }

    // Parent nodes
    if (
      (nodeTypeLoc === 'Object' || nodeTypeLoc === 'Array') &&
      !isLogLineField(keyPath[0].toString()) &&
      keyPath[0] !== JsonVizRootName &&
      !isNumber(keyPath[0])
    ) {
      return model.renderNestedNodeFilterButtons(keyPath, fieldsVar, jsonParserPropsMap, jsonFiltersSupported);
    }

    // Show the timestamp as the label of the log line
    if (isNumber(keyPath[0]) && keyPath[1] === JsonVizRootName) {
      const time: string = lineField.values[keyPath[0]]?.[JsonDataFrameTimeName];
      console.log('lineField', { lineField, lineFieldKeypath: lineField.values[keyPath[0]], values: lineField.values });
      return <strong>{time}</strong>;
    }

    // Don't render time node
    if (keyPath[0] === JsonDataFrameTimeName) {
      return null;
    }

    return <strong>{keyPath[0]}:</strong>;
  };
  // @ts-expect-error eslint complains if there is no display name, but typescript complains if there is a display name...
  LabelRendererComponent.displayName = 'Json.LabelRenderer';
  return LabelRendererComponent;
};

const getStyles = (theme: GrafanaTheme2, showHighlight: boolean) => {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'row-reverse',
      height: '100%',
      paddingBottom: theme.spacing(1),
      paddingRight: theme.spacing(1),
      ...getLogsHighlightStyles(theme, showHighlight),
    }),
    highlight: css({
      backgroundColor: 'rgb(255, 153, 0)',
      color: 'black',
    }),

    JSONTreeWrap: css`
      font-family: ${theme.typography.fontFamilyMonospace};
      font-family: ${theme.typography.fontFamilyMonospace}; // override css variables
      --json-tree-align-items: flex-start;
      --json-tree-label-color: ${theme.colors.text.secondary};
      --json-tree-label-value-color: ${theme.colors.text.primary};
      --json-tree-arrow-color: ${theme.colors.secondary.contrastText};
      --json-tree-ul-root-padding: 0 0 ${theme.spacing(2)} 0;

      overflow: auto;
      height: 100%;
      width: 100%;

      // Array and other labels additional without markup
      // @todo the base package should already apply this style
      strong {
        color: var(--json-tree-label-color);
      }

      // first nested node padding
      > ul > li > ul {
        // Hackery to keep elements from under the sticky header from being in the scrollable area
        padding: 0 0 0 ${theme.spacing(2)};
      }

      // Root node styles
      > ul > li > span {
        position: sticky;
        top: 0;
        left: 0;
        background: ${theme.colors.background.primary};
        padding-bottom: ${theme.spacing(0.5)};
        margin-bottom: ${theme.spacing(0.5)};
        box-shadow: 0 1px 7px rgba(1, 4, 9, 0.75);
        z-index: 2;
        padding-left: ${theme.spacing(1)};
        align-items: center;
        overflow-x: auto;
        overflow-y: hidden;
      }

      > ul > li > ul > li > span {
        position: sticky;
        top: 26px;
        left: 0;
        background: ${theme.colors.background.primary};
        z-index: 1;
      }
    `,
  };
};
