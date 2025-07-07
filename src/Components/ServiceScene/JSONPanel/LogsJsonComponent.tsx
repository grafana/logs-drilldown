import React, { useCallback, useRef } from 'react';

import { css } from '@emotion/css';

import { FieldType, GrafanaTheme2 } from '@grafana/data';
import { AdHocFilterWithLabels, SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { Alert, Badge, PanelChrome, useStyles2 } from '@grafana/ui';

import { isLogLineField } from '../../../services/fields';
import { getLogsHighlightStyles } from '../../../services/highlight';
import {
  setJsonHighlightVisibility,
  setJsonLabelsVisibility,
  setJsonMetadataVisibility,
} from '../../../services/store';
import { getFieldsVariable, getJsonFieldsVariable, getLineFiltersVariable } from '../../../services/variableGetters';
import { LogsPanelHeaderActions } from '../../Table/LogsHeaderActions';
import { NoMatchingLabelsScene } from '../Breakdowns/NoMatchingLabelsScene';
import LabelRenderer from '../JSONPanel/LabelRenderer';
import ValueRenderer from '../JSONPanel/ValueRenderer';
import { LogListControls } from '../LogListControls';
import { LogsJsonScene } from '../LogsJsonScene';
import { LogsListScene } from '../LogsListScene';
import { getLogsPanelFrame } from '../ServiceScene';
import GetItemString from './GetItemString';
import { JSONTree } from '@gtk-grafana/react-json-tree';

export default function LogsJsonComponent({ model }: SceneComponentProps<LogsJsonScene>) {
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
              shouldExpandNodeInitially={(_, __, level) => level <= 2}
              getItemString={(nodeType, data, itemType, itemString, keyPath) => (
                <GetItemString
                  itemString={itemString}
                  keyPath={keyPath}
                  itemType={itemType}
                  data={data}
                  nodeType={nodeType}
                />
              )}
              valueRenderer={(valueAsString, _, ...keyPath) => (
                <ValueRenderer valueAsString={valueAsString} keyPath={keyPath} lineFilterVar={lineFilterVar} />
              )}
              labelRenderer={(keyPath, nodeType) => (
                <LabelRenderer
                  model={model}
                  nodeType={nodeType}
                  keyPath={keyPath}
                  fieldsVar={fieldsVar}
                  lineField={lineField}
                  jsonFiltersSupported={jsonFiltersSupported}
                  jsonParserPropsMap={jsonParserPropsMap}
                />
              )}
            />
          </div>
        )}
        {emptyScene && lineField?.values.length === 0 && <NoMatchingLabelsScene.Component model={emptyScene} />}
      </div>
    </PanelChrome>
  );
}

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
