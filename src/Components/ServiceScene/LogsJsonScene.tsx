import React from 'react';
import {
  AdHocFiltersVariable,
  AdHocFilterWithLabels,
  SceneComponentProps,
  SceneDataState,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';
import { DataFrame, Field, FieldType, getTimeZone, GrafanaTheme2, LoadingState, PanelData } from '@grafana/data';
import { Alert, Badge, Button, Icon, PanelChrome, useStyles2 } from '@grafana/ui';

import { isNumber } from 'lodash';
import { css } from '@emotion/css';
import { JSONTree, KeyPath } from '@gtk-grafana/react-json-tree';

import { LogsListScene } from './LogsListScene';
import { getDetectedFieldsFrameFromQueryRunnerState, getLogsPanelFrame, ServiceScene } from './ServiceScene';
import { PanelMenu } from '../Panels/PanelMenu';
import { LogsPanelHeaderActions } from '../Table/LogsHeaderActions';
import { addToFilters, FilterType } from './Breakdowns/AddToFiltersButton';
import ReRootJSONButton from './JSONPanel/ReRootJSONButton';

import {
  clearJsonParserFields,
  getDetectedFieldsJsonPathField,
  getDetectedFieldsParserField,
  isLogLineField,
} from '../../services/fields';
import { FilterOp, LineFormatFilterOp } from '../../services/filterTypes';
import { getPrettyQueryExpr } from '../../services/scenes';
import {
  getFieldsVariable,
  getJsonFieldsVariable,
  getLineFormatVariable,
  getValueFromFieldsFilter,
} from '../../services/variableGetters';
import { hasProp } from '../../services/narrowing';
import {
  addJsonParserFieldValue,
  EMPTY_AD_HOC_FILTER_VALUE,
  getJsonKey,
  removeLineFormatFilters,
} from '../../services/filters';
import { addCurrentUrlToHistory } from '../../services/navigate';
import { EMPTY_VARIABLE_VALUE, VAR_FIELDS } from '../../services/variables';
import { LABEL_NAME_INVALID_CHARS } from '../../services/labels';
import { NoMatchingLabelsScene } from './Breakdowns/NoMatchingLabelsScene';
import { clearVariables } from '../../services/variableHelpers';
import JSONFilterNestedNodeButton from './JSONPanel/JSONFilterNestedNodeButton';
import JSONFilterValueButton from './JSONPanel/JSONFilterValueButton';
import {
  breadCrumbDelimiter,
  drillUpWrapperStyle,
  getJSONVizNestedProperty,
  getJSONVizValueLabelStyles,
  itemStringDelimiter,
  jsonLabelWrapStyles,
  renderJSONVizTimeStamp,
  rootNodeItemString,
} from '../../services/JSONViz';

interface LogsJsonSceneState extends SceneObjectState {
  menu?: PanelMenu;
  data?: PanelData;
  // While we still support loki versions that don't have https://github.com/grafana/loki/pull/16861, we need to disable filters for folks with older loki
  // If undefined, we haven't detected the loki version yet; if false, jsonPath (loki 3.5.0) is not supported
  jsonFiltersSupported?: boolean;
  hasJsonFields?: boolean;
  emptyScene?: NoMatchingLabelsScene;
}

export type NodeTypeLoc = 'String' | 'Boolean' | 'Number' | 'Custom' | 'Object' | 'Array';
export type AddJSONFilter = (keyPath: KeyPath, key: string, value: string, filterType: FilterType) => void;

const DataFrameTimeName = 'Time';
const DataFrameLineName = 'Line';
const VizRootName = 'root';

export class LogsJsonScene extends SceneObjectBase<LogsJsonSceneState> {
  constructor(state: Partial<LogsJsonSceneState>) {
    super(state);

    this.addActivationHandler(this.onActivate.bind(this));
  }

  public onActivate() {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);

    this.setState({
      menu: new PanelMenu({
        investigationOptions: { type: 'logs', getLabelName: () => `Logs: ${getPrettyQueryExpr(serviceScene)}` },
      }),
      emptyScene: new NoMatchingLabelsScene({ clearCallback: () => clearVariables(this) }),
    });

    const $data = sceneGraph.getData(this);
    if ($data.state.data?.state === LoadingState.Done) {
      this.transformDataFrame($data.state);
    }

    this._subs.add(
      $data.subscribeToState((newState) => {
        if (newState.data?.state === LoadingState.Done) {
          this.transformDataFrame(newState);
        }
      })
    );
    clearJsonParserFields(this);

    const detectedFieldFrame = getDetectedFieldsFrameFromQueryRunnerState(
      serviceScene.state?.$detectedFieldsData?.state
    );

    if (detectedFieldFrame && detectedFieldFrame.length) {
      // If the field count differs from the length of the dataframe or the fields count is not defined, then we either have a detected fields response from another scene, or the application is being initialized on this scene
      // In both cases we want to run the detected_fields query again to check for jsonPath support (loki 3.5.0) or to check if there are any JSON parsers for the current field set.
      // @todo remove when we drop support for Loki versions before 3.5.0
      if (
        !serviceScene.state.fieldsCount === undefined ||
        serviceScene.state.fieldsCount !== detectedFieldFrame?.length
      ) {
        serviceScene.state?.$detectedFieldsData?.runQueries();
      } else {
        this.setVizFlags(detectedFieldFrame);
      }
    }

    this._subs.add(
      serviceScene.state.$detectedFieldsData?.subscribeToState((newState) => {
        const detectedFieldFrame = getDetectedFieldsFrameFromQueryRunnerState(newState);
        if (detectedFieldFrame) {
          this.setVizFlags(detectedFieldFrame);
        }
      })
    );
  }

  /**
   * Checks detected_fields for jsonPath support added in 3.5.0
   * Remove when 3.5.0 is the oldest Loki version supported
   */
  private setVizFlags(detectedFieldFrame: DataFrame) {
    // the third field is the parser, see datasource.ts:getDetectedFields for more info
    if (getDetectedFieldsParserField(detectedFieldFrame)?.values.some((v) => v === 'json' || v === 'mixed')) {
      this.setState({
        jsonFiltersSupported: getDetectedFieldsJsonPathField(detectedFieldFrame)?.values.some((v) => v !== undefined),
        hasJsonFields: true,
      });
    } else {
      this.setState({
        hasJsonFields: false,
      });
    }
  }

  /**
   * Gets value from log Field at keyPath
   */
  private getValue(keyPath: KeyPath, lineField: Array<string | number>): string | number {
    const keys = [...keyPath];
    const accessors = [];

    while (keys.length) {
      const key = keys.pop();

      if (key !== VizRootName && key !== undefined) {
        accessors.push(key);
      }
    }

    return getJSONVizNestedProperty(lineField, accessors);
  }

  /**
   * Drill back up to a parent node via the sticky "breadcrumbs"
   */
  private addDrillUp = (key: string) => {
    addCurrentUrlToHistory();

    const lineFormatVariable = getLineFormatVariable(this);
    const jsonVar = getJsonFieldsVariable(this);
    const fieldsVar = getFieldsVariable(this);

    const lineFormatFilters = lineFormatVariable.state.filters;
    const keyIndex = lineFormatFilters.findIndex((filter) => filter.key === key);
    const lineFormatFiltersToKeep = lineFormatFilters.filter((_, index) => index <= keyIndex);
    const jsonParserKeys: string[] = [];

    for (let i = 0; i < lineFormatFilters.length; i++) {
      jsonParserKeys.push(
        `${
          jsonParserKeys.length
            ? `${lineFormatFilters
                .map((filter) => filter.key)
                .slice(0, i)
                .join('_')}_`
            : ''
        }${lineFormatFilters[i].key}`
      );
    }

    const jsonParserKeysToRemove = jsonParserKeys.slice(keyIndex + 1);
    const fieldsFilterSet = new Set();
    fieldsVar.state.filters.forEach((fieldFilter) => fieldsFilterSet.add(fieldFilter.key));

    const jsonParserFilters = jsonVar.state.filters.filter(
      (filter) => !jsonParserKeysToRemove.includes(filter.key) || fieldsFilterSet.has(filter.key)
    );

    jsonVar.setState({
      filters: jsonParserFilters,
    });
    lineFormatVariable.setState({
      filters: lineFormatFiltersToKeep,
    });
  };

  /**
   * Drills into node specified by keyPath
   * Note, if we've already drilled down into a node, the keyPath (from the viz) will not have the parent nodes we need to build the json parser fields.
   * We re-create the full key path using the values currently stored in the lineFormat variable
   */
  private setNewRootNode = (keyPath: KeyPath) => {
    addCurrentUrlToHistory();
    const { fullPathFilters, fullKeyPath } = this.getFullKeyPath(keyPath);

    // If keyPath length is greater than 3 we're drilling down (root, line index, line)
    if (keyPath.length > 3) {
      addJsonParserFieldValue(this, fullKeyPath);

      const lineFormatVar = getLineFormatVariable(this);
      lineFormatVar.setState({
        filters: fullPathFilters,
      });
    } else {
      // Otherwise we're drilling back up to the root
      removeLineFormatFilters(this);
      clearJsonParserFields(this);
    }
  };

  /**
   * Reconstructs the full keyPath even if a line filter is set and the user is currently drilled down into a nested node
   */
  private getFullKeyPath(keyPath: ReadonlyArray<string | number>) {
    const lineFormatVar = getLineFormatVariable(this);

    const fullPathFilters: AdHocFilterWithLabels[] = [
      ...lineFormatVar.state.filters,
      ...keyPath
        // line format filters only store the parent node field names
        .filter((key) => typeof key === 'string' && !isLogLineField(key) && key !== VizRootName)
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
    return { fullPathFilters, fullKeyPath };
  }

  /**
   * Adds a fields filter and JSON parser props on viz interaction
   */
  private addFilter: AddJSONFilter = (keyPath: KeyPath, key: string, value: string, filterType: FilterType) => {
    addCurrentUrlToHistory();
    // https://grafana.com/docs/loki/latest/get-started/labels/#label-format
    key = key.replace(LABEL_NAME_INVALID_CHARS, '_');

    addJsonParserFieldValue(this, keyPath);

    const logsListScene = sceneGraph.getAncestor(this, LogsListScene);
    addToFilters(key, value, filterType, logsListScene, VAR_FIELDS, false, true);
  };

  /**
   * Formats key from keypath
   */
  private getKeyPathString(keyPath: KeyPath, sepChar = ':') {
    return keyPath[0] !== DataFrameTimeName ? keyPath[0] + sepChar : keyPath[0];
  }

  public static Component = ({ model }: SceneComponentProps<LogsJsonScene>) => {
    // const styles = getStyles(grafanaTheme)
    const { menu, data, jsonFiltersSupported, hasJsonFields, emptyScene } = model.useState();
    const $data = sceneGraph.getData(model);
    // Rerender on data change
    $data.useState();
    const logsListScene = sceneGraph.getAncestor(model, LogsListScene);
    const { visualizationType } = logsListScene.useState();
    const styles = useStyles2(getStyles);

    const fieldsVar = getFieldsVariable(model);
    const jsonVar = getJsonFieldsVariable(model);

    // If we have a line format variable, we are drilled down into a nested node
    const dataFrame = getLogsPanelFrame(data);
    const lineField = dataFrame?.fields.find((field) => field.type === FieldType.string && isLogLineField(field.name));

    const jsonParserPropsMap = new Map<string, AdHocFilterWithLabels>();
    jsonVar.state.filters.forEach((filter) => {
      // @todo this should probably be set in the AdHocFilterWithLabels valueLabels array
      // all json props are wrapped with [\" ... "\], strip those chars out so we have the actual key used in the json
      const fullKeyFromJsonParserProps = filter.value
        .substring(3, filter.value.length - 3)
        .split('\\"][\\"')
        .join('_');
      jsonParserPropsMap.set(fullKeyFromJsonParserProps, filter);
    });

    return (
      <PanelChrome
        padding={'none'}
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
        {dataFrame && lineField?.values && (
          <span className={styles.JSONTreeWrap}>
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
              getItemString={(_, data, itemType, itemString, keyPath) => {
                if (data && hasProp(data, DataFrameTimeName) && typeof data.Time === 'string') {
                  return null;
                }
                if (keyPath[0] === VizRootName) {
                  return (
                    <span className={rootNodeItemString}>
                      {itemType} {itemString}
                    </span>
                  );
                }

                return <span>{itemType}</span>;
              }}
              valueRenderer={(valueAsString, _, keyPath) => {
                if (keyPath === DataFrameTimeName) {
                  return null;
                }

                return <>{valueAsString?.toString()}</>;
              }}
              shouldExpandNodeInitially={(_, __, level) => level <= 2}
              labelRenderer={(keyPath, nodeType) => {
                const nodeTypeLoc = nodeType as NodeTypeLoc;

                if (keyPath[0] === VizRootName) {
                  return model.renderNestedNodeButtons(keyPath, jsonFiltersSupported);
                }

                // Value nodes
                if (
                  nodeTypeLoc !== 'Object' &&
                  nodeTypeLoc !== 'Array' &&
                  keyPath[0] !== DataFrameTimeName &&
                  !isLogLineField(keyPath[0].toString()) &&
                  keyPath[0] !== VizRootName &&
                  !isNumber(keyPath[0])
                ) {
                  return model.renderValueLabel(
                    keyPath,
                    lineField,
                    fieldsVar,
                    jsonParserPropsMap,
                    jsonFiltersSupported
                  );
                }

                // Parent nodes
                if (
                  (nodeTypeLoc === 'Object' || nodeTypeLoc === 'Array') &&
                  !isLogLineField(keyPath[0].toString()) &&
                  keyPath[0] !== VizRootName &&
                  !isNumber(keyPath[0])
                ) {
                  return model.renderNestedNodeFilterButtons(
                    keyPath,
                    fieldsVar,
                    jsonParserPropsMap,
                    jsonFiltersSupported
                  );
                }

                // Show the timestamp as the label of the log line
                if (isNumber(keyPath[0]) && keyPath[1] === VizRootName) {
                  const time = lineField.values[keyPath[0]]?.[DataFrameTimeName];
                  return <strong>{time}</strong>;
                }

                // Don't render time node
                if (keyPath[0] === DataFrameTimeName) {
                  return null;
                }

                return <strong>{keyPath[0]}:</strong>;
              }}
            />
          </span>
        )}
        {emptyScene && lineField?.values.length === 0 && <NoMatchingLabelsScene.Component model={emptyScene} />}
      </PanelChrome>
    );
  };

  /**
   * Gets re-root button and key label for root node when line format filter is active.
   * aka breadcrumbs
   */
  private renderNestedNodeButtons = (keyPath: KeyPath, jsonFiltersSupported?: boolean) => {
    const lineFormatVar = getLineFormatVariable(this);
    const filters = lineFormatVar.state.filters;
    const rootKeyPath = [DataFrameLineName, 0, VizRootName];

    return (
      <>
        <span className={drillUpWrapperStyle} key={VizRootName}>
          <Button
            size={'sm'}
            onClick={() => jsonFiltersSupported && this.setNewRootNode(rootKeyPath)}
            variant={'secondary'}
            fill={'outline'}
            disabled={!filters.length}
            name={keyPath[0].toString()}
          >
            {this.getKeyPathString(keyPath, filters.length ? '' : ':')}
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
                  onClick={() => jsonFiltersSupported && this.addDrillUp(filter.key)}
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
  };

  /**
   * Gets filter buttons for a nested JSON node
   */
  private renderNestedNodeFilterButtons = (
    keyPath: KeyPath,
    fieldsVar: AdHocFiltersVariable,
    jsonParserPropsMap: Map<string, AdHocFilterWithLabels>,
    jsonFiltersSupported?: boolean
  ) => {
    const { fullKeyPath } = this.getFullKeyPath(keyPath);
    const fullKey = getJsonKey(fullKeyPath);
    const jsonParserProp = jsonParserPropsMap.get(fullKey);
    const existingFilter =
      jsonParserProp &&
      fieldsVar.state.filters.find(
        (f) => f.key === jsonParserProp?.key && getValueFromFieldsFilter(f).value === EMPTY_VARIABLE_VALUE
      );

    return (
      <span className={jsonLabelWrapStyles}>
        {jsonFiltersSupported && (
          <>
            <ReRootJSONButton keyPath={keyPath} setNewRootNode={this.setNewRootNode} />
            <JSONFilterNestedNodeButton
              type={'include'}
              jsonKey={fullKey}
              addFilter={this.addFilter}
              keyPath={fullKeyPath}
              active={existingFilter?.operator === FilterOp.NotEqual}
            />
            <JSONFilterNestedNodeButton
              type={'exclude'}
              jsonKey={fullKey}
              addFilter={this.addFilter}
              keyPath={fullKeyPath}
              active={existingFilter?.operator === FilterOp.Equal}
            />
          </>
        )}
        <strong>{this.getKeyPathString(keyPath)}</strong>
      </span>
    );
  };

  /**
   * Gets a value label and filter buttons
   */
  private renderValueLabel = (
    keyPath: KeyPath,
    lineField: Field<string | number>,
    fieldsVar: AdHocFiltersVariable,
    jsonParserPropsMap: Map<string, AdHocFilterWithLabels>,
    jsonFiltersSupported?: boolean
  ) => {
    const styles = useStyles2(getJSONVizValueLabelStyles);

    const value = this.getValue(keyPath, lineField.values)?.toString();
    const label = keyPath[0];
    const { fullKeyPath } = this.getFullKeyPath(keyPath);
    const fullKey = getJsonKey(fullKeyPath);
    const jsonParserProp = jsonParserPropsMap.get(fullKey);
    const existingFilter =
      jsonParserProp &&
      fieldsVar.state.filters.find((f) => f.key === jsonParserProp?.key && getValueFromFieldsFilter(f).value === value);

    return (
      <span className={styles.labelButtonsWrap}>
        {jsonFiltersSupported && (
          <>
            <JSONFilterValueButton
              label={label}
              value={value}
              fullKeyPath={fullKeyPath}
              fullKey={fullKey}
              addFilter={this.addFilter}
              existingFilter={existingFilter}
              type={'include'}
            />
            <JSONFilterValueButton
              label={label}
              value={value}
              fullKeyPath={fullKeyPath}
              fullKey={fullKey}
              addFilter={this.addFilter}
              existingFilter={existingFilter}
              type={'exclude'}
            />
          </>
        )}
        <strong className={styles.labelWrap}>{this.getKeyPathString(keyPath)}</strong>
      </span>
    );
  };

  /**
   * Creates the dataframe consumed by the viz
   */
  private transformDataFrame(newState: SceneDataState) {
    const dataFrame = getLogsPanelFrame(newState.data);
    const time = dataFrame?.fields.find((field) => field.type === FieldType.time);

    const timeZone = getTimeZone();
    if (newState.data) {
      const transformedData: PanelData = {
        ...newState.data,
        series: newState.data.series.map((frame) => {
          return {
            ...frame,

            fields: frame.fields.map((f) => {
              if (isLogLineField(f.name)) {
                return {
                  ...f,
                  values: f.values
                    .map((v, i) => {
                      let parsed;
                      try {
                        parsed = JSON.parse(v);
                      } catch (e) {
                        // @todo add error message in result?
                        parsed = v;
                      }

                      return {
                        [DataFrameTimeName]: renderJSONVizTimeStamp(time?.values?.[i], timeZone),
                        [DataFrameLineName]: parsed,
                        // @todo add support for structured metadata
                        // Labels: labels?.values?.[0],
                      };
                    })
                    .filter((f) => f),
                };
              }
              return f;
            }),
          };
        }),
      };
      this.setState({
        data: transformedData,
      });
    }
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  JSONTreeWrap: css`
    // override css variables
    --json-tree-align-items: flex-start;
    --json-tree-label-color: ${theme.colors.text.secondary};
    --json-tree-label-value-color: ${theme.colors.text.primary};
    --json-tree-arrow-color: ${theme.colors.secondary.contrastText};
    --json-tree-ul-root-padding: 0 0 ${theme.spacing(2)} 0;

    // first nested node padding
    > ul > li > ul {
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
      overflow-x: scroll;
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
});
