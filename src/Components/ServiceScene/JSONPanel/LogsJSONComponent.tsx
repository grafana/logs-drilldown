import React, { useCallback, useMemo, useRef } from 'react';

import { css } from '@emotion/css';

import { colorManipulator, FieldType, GrafanaTheme2 } from '@grafana/data';
import { AdHocFilterWithLabels, SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { Alert, PanelChrome, useStyles2 } from '@grafana/ui';

import { NoMatchingLabelsScene } from '../Breakdowns/NoMatchingLabelsScene';
import { JSONLogsScene, JSONVizRootName } from '../JSONLogsScene';
import LabelRenderer from '../JSONPanel/LabelRenderer';
import ValueRenderer from '../JSONPanel/ValueRenderer';
import { LogListControls } from '../LogListControls';
import { LogsListScene } from '../LogsListScene';
import { LogsPanelError } from '../LogsPanelError';
import { getLogsPanelFrame } from '../ServiceScene';
import ItemString from './ItemString';
import { JSONTree } from '@gtk-grafana/react-json-tree';
import { ScrollToPath } from '@gtk-grafana/react-json-tree/dist/types';
import { LogsPanelHeaderActions } from 'Components/Table/LogsHeaderActions';
import { isLogLineField, isLogsIdField } from 'services/fields';
import { getLogsHighlightStyles } from 'services/highlight';
import {
  setJSONHighlightVisibility,
  setJSONLabelsVisibility,
  setJSONMetadataVisibility,
  setLogOption,
} from 'services/store';
import {
  getFieldsVariable,
  getJSONFieldsVariable,
  getLevelsVariable,
  getLineFiltersVariable,
} from 'services/variableGetters';
import { clearVariables } from 'services/variableHelpers';

export const JSON_VIZ_LINE_HEIGHT = '24px';

export default function LogsJSONComponent({ model }: SceneComponentProps<JSONLogsScene>) {
  const {
    canClearFilters,
    emptyScene,
    error,
    errorType,
    hasJSONFields,
    JSONFiltersSupported,
    menu,
    hasHighlight,
    hasLabels,
    hasMetadata,
    sortOrder,
    wrapLogMessage,
    data,
    rawFrame,
  } = model.useState();
  // Rerender on data change
  const $data = sceneGraph.getData(model);
  $data.useState();

  const logsListScene = sceneGraph.getAncestor(model, LogsListScene);
  const { visualizationType, selectedLine } = logsListScene.useState();
  const styles = useStyles2(getStyles, wrapLogMessage);

  const fieldsVar = getFieldsVariable(model);
  const JSONVariable = getJSONFieldsVariable(model);
  const levelsVar = getLevelsVariable(model);

  // If we have a line format variable, we are drilled down into a nested node
  const dataFrame = getLogsPanelFrame(data);
  const lineField = dataFrame?.fields.find((field) => field.type === FieldType.string && isLogLineField(field.name));
  const JSONParserPropsMap = new Map<string, AdHocFilterWithLabels>();
  const lineFilterVar = getLineFiltersVariable(model);

  const scrollToPath: ScrollToPath | undefined = useMemo(() => {
    if (selectedLine === undefined) {
      return undefined;
    }
    const idField = rawFrame?.fields.find((field) => isLogsIdField(field.name));
    const lineIndex = idField?.values.findIndex((v) => v === selectedLine?.id);
    const cleanLineIndex = lineIndex !== undefined && lineIndex !== -1 ? lineIndex : undefined;
    return cleanLineIndex !== undefined ? [cleanLineIndex, JSONVizRootName] : undefined;
  }, [selectedLine, rawFrame]);

  JSONVariable.state.filters.forEach((filter) => {
    // @todo this should probably be set in the AdHocFilterWithLabels valueLabels array
    // all json props are wrapped with [\" ... "\], strip those chars out so we have the actual key used in the json
    const fullKeyFromJSONParserProps = filter.value
      .substring(3, filter.value.length - 3)
      .split('\\"][\\"')
      .join('_');
    JSONParserPropsMap.set(fullKeyFromJSONParserProps, filter);
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
      model.setState({ hasMetadata: visible });
      setJSONMetadataVisibility(visible);
    },
    [model]
  );

  const onToggleLabelsClick = useCallback(
    (visible: boolean) => {
      model.setState({ hasLabels: visible });
      setJSONLabelsVisibility(visible);
    },
    [model]
  );

  const onToggleHighlightClick = useCallback(
    (visible: boolean) => {
      model.setState({ hasHighlight: visible });
      setJSONHighlightVisibility(visible);
    },
    [model]
  );

  const onWrapLogMessageClick = useCallback(
    (wrap: boolean) => {
      model.setState({ wrapLogMessage: wrap });
      setLogOption('wrapLogMessage', wrap);
    },
    [model]
  );

  const showNoJSONDetected = lineField && lineField.values.length > 0 && hasJSONFields === false;
  const showLokiNotSupported = !JSONFiltersSupported && showNoJSONDetected !== true;
  const controlsExpanded = logsListScene.state.controlsExpanded;

  return (
    <div className={styles.panelChromeWrap}>
      {!error && (
        <>
          {/* @ts-expect-error todo: fix this when https://github.com/grafana/grafana/issues/103486 is done*/}
          <PanelChrome
            padding={'none'}
            showMenuAlways={true}
            statusMessage={$data.state.data?.errors?.[0].message}
            loadingState={$data.state.data?.state}
            title={'JSON'}
            menu={menu ? <menu.Component model={menu} /> : undefined}
            actions={
              <LogsPanelHeaderActions vizType={visualizationType} onChange={logsListScene.setVisualizationType} />
            }
          >
            <div className={styles.container}>
              {lineField?.values && lineField?.values.length > 0 && (
                <LogListControls
                  controlsExpanded={controlsExpanded}
                  onExpandControlsClick={() => {
                    logsListScene.setState({ controlsExpanded: !controlsExpanded });
                    setLogOption('controlsExpanded', !controlsExpanded);
                  }}
                  onWrapLogMessageClick={onWrapLogMessageClick}
                  wrapLogMessage={wrapLogMessage}
                  showHighlight={hasHighlight}
                  onToggleHighlightClick={onToggleHighlightClick}
                  showMetadata={hasMetadata}
                  onToggleStructuredMetadataClick={onToggleStructuredMetadataClick}
                  showLabels={hasLabels}
                  onToggleLabelsClick={onToggleLabelsClick}
                  sortOrder={sortOrder}
                  onSortOrderChange={model.handleSortChange}
                  onScrollToBottomClick={onScrollToBottomClick}
                  onScrollToTopClick={onScrollToTopClick}
                />
              )}
              {lineField?.values && lineField?.values.length > 0 && (
                <div className={styles.JSONTreeWrap} ref={scrollRef}>
                  {showLokiNotSupported && (
                    <Alert className={styles.alert} severity={'warning'} title={'JSON filtering requires Loki 3.5.0.'}>
                      This view will be read only until Loki is upgraded to 3.5.0
                    </Alert>
                  )}
                  {showNoJSONDetected && (
                    <Alert className={styles.alert} severity={'info'} title={'No JSON fields detected'}>
                      This view is built for JSON log lines, but none were detected. Switch to the Logs or Table view
                      for a better experience.
                    </Alert>
                  )}
                  <JSONTree
                    scrollToPath={scrollToPath}
                    data={lineField.values}
                    hideRootExpand={true}
                    valueWrap={''}
                    shouldExpandNodeInitially={(_, __, level) => level <= 2}
                    // Render item type string, e.g. (), {}
                    getItemString={(nodeType, data, itemType, itemString, keyPath) => (
                      <ItemString
                        itemString={itemString}
                        keyPath={keyPath}
                        itemType={itemType}
                        data={data}
                        nodeType={nodeType}
                        model={model}
                        levelsVar={levelsVar}
                      />
                    )}
                    // Render node values
                    valueRenderer={(valueAsString, _, ...keyPath) => (
                      <ValueRenderer
                        valueAsString={valueAsString}
                        keyPath={keyPath}
                        lineFilters={lineFilterVar.state.filters}
                        model={model}
                      />
                    )}
                    // Render node labels
                    labelRenderer={(keyPath, nodeType) => (
                      <LabelRenderer
                        model={model}
                        nodeType={nodeType}
                        keyPath={keyPath}
                        fieldsVar={fieldsVar}
                        lineField={lineField}
                        JSONFiltersSupported={JSONFiltersSupported}
                        JSONParserPropsMap={JSONParserPropsMap}
                        lineFilters={lineFilterVar.state.filters}
                      />
                    )}
                  />
                </div>
              )}
              {emptyScene && lineField?.values.length === 0 && <NoMatchingLabelsScene.Component model={emptyScene} />}
            </div>
          </PanelChrome>
        </>
      )}
      {error && (
        <LogsPanelError
          error={error}
          errorType={errorType}
          clearFilters={canClearFilters ? () => clearVariables(model) : undefined}
        />
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, wrapLogMessage: boolean) => {
  const hoverBg = theme.isDark
    ? colorManipulator.alpha(colorManipulator.lighten(theme.colors.background.canvas, 0.1), 0.4)
    : colorManipulator.alpha(colorManipulator.darken(theme.colors.background.canvas, 0.1), 0.4);

  const selectedBg = theme.isDark
    ? colorManipulator.darken(colorManipulator.alpha(theme.colors.info.transparent, 1), 0.2)
    : colorManipulator.lighten(colorManipulator.alpha(theme.colors.info.transparent, 1), 0.2);

  return {
    alert: css({
      marginTop: theme.spacing(3.5),
      marginBottom: 0,
    }),
    panelChromeWrap: css({
      // Required to keep content from pushing out of page wrapper when the grafana menu is docked
      contain: 'strict',
      width: '100%',
      height: '100%',
    }),
    container: css({
      display: 'flex',
      flexDirection: 'row-reverse',
      height: '100%',
      paddingBottom: theme.spacing(1),
      paddingRight: theme.spacing(1),
      ...getLogsHighlightStyles(theme),
      contain: 'content',
    }),
    highlight: css({
      backgroundColor: 'rgb(255, 153, 0)',
      color: 'black',
    }),

    JSONTreeWrap: css`
      font-family: ${theme.typography.fontFamilyMonospace};
      font-family: ${theme.typography.fontFamilyMonospace}; // override css variables
      --json-tree-align-items: flex-start;
      --json-tree-label-color: ${theme.colors.text.primary};
      --json-tree-label-value-color: ${theme.colors.text.secondary};
      --json-tree-arrow-color: ${theme.colors.secondary.contrastText};
      --json-tree-ul-root-padding: ${theme.spacing(3)} 0 ${theme.spacing(2)} 0;
      --json-tree-arrow-left-offset: -${theme.spacing(2)};
      --json-tree-inline: inline-grid;
      --json-tree-value-label-margin: 1em;
      // Scroll offset for sticky header
      --json-tree-scroll-margin: 26px;
      // Scroll behavior @todo set "auto" instead of "smooth" for users with prefers-reduced-motion
      scroll-behavior: ${window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'};
      ${getWrapLogMessageStyles(theme, wrapLogMessage)}

      overflow: auto;
      height: 100%;
      width: 100%;
      // Prevents scrollbar from getting tucked behind the fixed header
      clip-path: inset(0 0 0 0);

      // Line height defines the height of each line
      li {
        line-height: ${JSON_VIZ_LINE_HEIGHT};
      }

      //first treeItem node
      > ul > li {
        // line wrap
        width: 100%;
        margin-top: ${theme.spacing(2.5)};
      }

      // Array and other labels additional without markup
      // first nested node padding
      > ul > li > ul {
        // Hackery to keep elements from under the sticky header from being in the scrollable area
        padding: 0 0 0 ${theme.spacing(2)};
      }

      // Root node styles
      > ul > li > span {
        position: fixed;
        top: 0;
        left: 0;
        width: calc(100% - ${theme.spacing(4.75)});
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

      // Line node scrolledTo styles
      li[data-scrolled='true'] {
        // sticky header cannot have transparency!
        & > span {
          background-color: ${selectedBg};
        }
        background-color: ${colorManipulator.alpha(theme.colors.info.transparent, 0.25)};
      }

      // Value node background hover colors
      .valueNode--String,
      .valueNode--Number {
        &:hover {
          // This is the value line the user is hovering over, we don't want transparency so it always stands out from the bg
          background-color: ${theme.colors.background.canvas};
          box-shadow: ${theme.shadows.z1};
        }
      }

      // Nested node hover styles
      ul > li > ul > li > ul {
        li[data-nodetype='Object'],
        li[data-nodetype='Array'] {
          // This is the nested node line the user is hovering over, we don't want transparency so it always stands out from the bg
          & > span {
            width: 100%;
            &:hover {
              background-color: ${theme.colors.background.canvas};
              box-shadow: ${theme.shadows.z1};
            }
          }
          // And this is the node the user is hovering in, we want some transparency to help differentiate between nodes of differing depths
          &:hover {
            background-color: ${hoverBg};
            box-shadow: ${theme.shadows.z1};
          }
        }
      }

      // sticky time header
      > ul > li > ul > li > span,
      > ul > li > ul > div > li > span {
        position: sticky;
        width: 100%;
        top: 26px;
        left: 0;
        background: ${theme.colors.background.primary};
        z-index: 1;
        display: flex;
        align-items: center;
        &:hover {
          background-color: ${theme.colors.background.canvas};
          box-shadow: ${theme.shadows.z1};
        }
      }
    `,
  };
};

const getWrapLogMessageStyles = (theme: GrafanaTheme2, wrapLogMessage: boolean) => {
  if (!wrapLogMessage) {
    return css`
      // line wrap
      --json-tree-value-text-wrap: nowrap;
    `;
  }

  return undefined;
};
