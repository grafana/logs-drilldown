import React, { useCallback, useRef } from 'react';

import { css } from '@emotion/css';
import { isNumber } from 'lodash';

import {
  DataFrame,
  Field,
  FieldType,
  getTimeZone,
  GrafanaTheme2,
  LoadingState,
  LogsSortOrder,
  PanelData,
} from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  AdHocFilterWithLabels,
  SceneComponentProps,
  SceneDataState,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneQueryRunner,
} from '@grafana/scenes';
import { Alert, Badge, Button, Icon, PanelChrome, useStyles2 } from '@grafana/ui';

import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import {
  clearJsonParserFields,
  getDetectedFieldsJsonPathField,
  getDetectedFieldsParserField,
  isLabelsField,
  isLabelTypesField,
  isLogLineField,
} from '../../services/fields';
import { LabelType } from '../../services/fieldsTypes';
import {
  addJsonParserFieldValue,
  EMPTY_AD_HOC_FILTER_VALUE,
  getJsonKey,
  LABELS_TO_REMOVE,
  removeLineFormatFilters,
} from '../../services/filters';
import { FilterOp, LineFormatFilterOp } from '../../services/filterTypes';
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
import { LABEL_NAME_INVALID_CHARS } from '../../services/labels';
import { hasProp, narrowLogsSortOrder } from '../../services/narrowing';
import { addCurrentUrlToHistory } from '../../services/navigate';
import { getPrettyQueryExpr } from '../../services/scenes';
import {
  getAdHocFiltersVariable,
  getFieldsVariable,
  getJsonFieldsVariable,
  getLineFormatVariable,
  getValueFromFieldsFilter,
} from '../../services/variableGetters';
import { clearVariables } from '../../services/variableHelpers';
import {
  EMPTY_VARIABLE_VALUE,
  LEVEL_VARIABLE_VALUE,
  VAR_FIELDS,
  VAR_LABELS,
  VAR_LEVELS,
  VAR_METADATA,
} from '../../services/variables';
import { PanelMenu } from '../Panels/PanelMenu';
import { LogsPanelHeaderActions } from '../Table/LogsHeaderActions';
import { addToFilters, FilterType, InterpolatedFilterType } from './Breakdowns/AddToFiltersButton';
import { NoMatchingLabelsScene } from './Breakdowns/NoMatchingLabelsScene';
import JSONFilterNestedNodeButton from './JSONPanel/JSONFilterNestedNodeButton';
import { FilterValueButton, JSONFilterValueButton } from './JSONPanel/JSONFilterValueButton';
import ReRootJSONButton from './JSONPanel/ReRootJSONButton';
import { LogListControls } from './LogListControls';
import { LogsListScene } from './LogsListScene';
import { getDetectedFieldsFrameFromQueryRunnerState, getLogsPanelFrame, ServiceScene } from './ServiceScene';
import { JSONTree, KeyPath } from '@gtk-grafana/react-json-tree';
import { logger } from 'services/logger';
import {
  getJsonLabelsVisibility,
  getJsonMetadataVisibility,
  getLogOption,
  setJsonLabelsVisibility,
  setJsonMetadataVisibility,
  setLogOption,
} from 'services/store';

interface LogsJsonSceneState extends SceneObjectState {
  data?: PanelData;
  emptyScene?: NoMatchingLabelsScene;
  hasJsonFields?: boolean;
  // While we still support loki versions that don't have https://github.com/grafana/loki/pull/16861, we need to disable filters for folks with older loki
  // If undefined, we haven't detected the loki version yet; if false, jsonPath (loki 3.5.0) is not supported
  jsonFiltersSupported?: boolean;
  menu?: PanelMenu;
  showLabels: boolean;
  showMetadata: boolean;
  sortOrder: LogsSortOrder;
}

export type NodeTypeLoc = 'Array' | 'Boolean' | 'Custom' | 'Number' | 'Object' | 'String';
export type AddJSONFilter = (keyPath: KeyPath, key: string, value: string, filterType: FilterType) => void;
export type AddMetadataFilter = (
  key: string,
  value: string,
  filterType: FilterType,
  variableType: InterpolatedFilterType
) => void;

const DataFrameTimeName = 'Time';
const DataFrameLineName = 'Line';
const StructuredMetadataDisplayName = 'Metadata';
const LabelsDisplayName = 'Labels';
const DataFrameStructuredMetadataName = '__Metadata';
const DataFrameLabelsName = '__Labels';
const VizRootName = 'root';

export class LogsJsonScene extends SceneObjectBase<LogsJsonSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: ['sortOrder'],
  });

  constructor(state: Partial<LogsJsonSceneState>) {
    super({
      ...state,
      showLabels: getJsonLabelsVisibility(),
      showMetadata: getJsonMetadataVisibility(),
      sortOrder: getLogOption<LogsSortOrder>('sortOrder', LogsSortOrder.Descending),
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private setStateFromUrl() {
    const searchParams = new URLSearchParams(locationService.getLocation().search);

    this.updateFromUrl({
      sortOrder: searchParams.get('sortOrder'),
    });
  }

  getUrlState() {
    return {
      sortOrder: JSON.stringify(this.state.sortOrder),
    };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    try {
      if (typeof values.sortOrder === 'string' && values.sortOrder) {
        const decodedSortOrder = narrowLogsSortOrder(JSON.parse(values.sortOrder));
        if (decodedSortOrder) {
          this.setState({ sortOrder: decodedSortOrder });
        }
      }
    } catch (e) {
      // URL Params can be manually changed and it will make JSON.parse() fail.
      logger.error(e, { msg: 'LogsJsonScene: updateFromUrl unexpected error' });
    }
  }

  public onActivate() {
    this.setStateFromUrl();

    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);

    this.setState({
      emptyScene: new NoMatchingLabelsScene({ clearCallback: () => clearVariables(this) }),
      menu: new PanelMenu({
        investigationOptions: { getLabelName: () => `Logs: ${getPrettyQueryExpr(serviceScene)}`, type: 'logs' },
      }),
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
    } else if (serviceScene.state?.$detectedFieldsData?.state.data?.state === undefined) {
      serviceScene.state?.$detectedFieldsData?.runQueries();
    }

    // Subscribe to detected fields
    this._subs.add(
      serviceScene.state?.$detectedFieldsData?.subscribeToState((newState) => {
        if (newState.data?.state === LoadingState.Done && newState.data?.series.length) {
          this.setVizFlags(newState.data.series[0]);
        }
      })
    );

    // Subscribe to options state changes
    this._subs.add(
      this.subscribeToState((newState, prevState) => {
        if (newState.showMetadata !== prevState.showMetadata || newState.showLabels !== prevState.showLabels) {
          this.transformDataFrame($data.state);
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
        hasJsonFields: true,
        jsonFiltersSupported: getDetectedFieldsJsonPathField(detectedFieldFrame)?.values.some((v) => v !== undefined),
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

    this.lineFormatEvent('remove', key);
  };

  /**
   * Drills down into node specified by keyPath
   * Note, if we've already drilled down into a node, the keyPath (from the viz) will not have the parent nodes we need to build the json parser fields.
   * We re-create the full key path using the values currently stored in the lineFormat variable
   */
  private setNewRootNode = (keyPath: KeyPath) => {
    addCurrentUrlToHistory();
    const { fullKeyPath, fullPathFilters } = this.getFullKeyPath(keyPath);
    // If keyPath length is greater than 3 we're drilling down (root, line index, line)
    if (keyPath.length > 3) {
      addJsonParserFieldValue(this, fullKeyPath);

      const lineFormatVar = getLineFormatVariable(this);

      lineFormatVar.setState({
        // Need to strip out any unsupported chars to match the field name we're creating in the json parser args
        filters: fullPathFilters.map((filter) => ({
          ...filter,
          key: filter.key.replace(LABEL_NAME_INVALID_CHARS, '_'),
        })),
      });
      this.lineFormatEvent('add', keyPath[0].toString());
    } else {
      // Otherwise we're drilling back up to the root
      removeLineFormatFilters(this);
      clearJsonParserFields(this);
      this.lineFormatEvent('remove', VizRootName);
    }
  };

  /**
   * Fires rudderstack event when the viz adds/removes a new root (line format)
   */
  private lineFormatEvent = (type: 'add' | 'remove', key: string) => {
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
    return { fullKeyPath, fullPathFilters };
  }

  private addFilter = (key: string, value: string, filterType: FilterType, variableType: InterpolatedFilterType) => {
    addCurrentUrlToHistory();
    const logsListScene = sceneGraph.getAncestor(this, LogsListScene);
    addToFilters(key, value, filterType, logsListScene, variableType, false);
    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.add_to_filters_in_json_panel,
      {
        action: filterType,
        filterType,
        key,
      }
    );
  };

  /**
   * Adds a fields filter and JSON parser props on viz interaction
   */
  private addJsonFilter: AddJSONFilter = (keyPath: KeyPath, key: string, value: string, filterType: FilterType) => {
    addCurrentUrlToHistory();
    // https://grafana.com/docs/loki/latest/get-started/labels/#label-format
    key = key.replace(LABEL_NAME_INVALID_CHARS, '_');

    addJsonParserFieldValue(this, keyPath);

    const logsListScene = sceneGraph.getAncestor(this, LogsListScene);
    addToFilters(key, value, filterType, logsListScene, VAR_FIELDS, false, true);

    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.add_to_filters_in_json_panel,
      {
        action: filterType,
        filterType: 'json',
        key,
      }
    );
  };

  handleSortChange = (newOrder: LogsSortOrder) => {
    if (newOrder === this.state.sortOrder) {
      return;
    }
    setLogOption('sortOrder', newOrder);
    const $data = sceneGraph.getData(this);
    const queryRunner =
      $data instanceof SceneQueryRunner ? $data : sceneGraph.findDescendents($data, SceneQueryRunner)[0];
    if (queryRunner) {
      queryRunner.runQueries();
    }
    this.setState({ sortOrder: newOrder });
  };

  /**
   * Formats key from keypath
   */
  private getKeyPathString(keyPath: KeyPath, sepChar = ':') {
    return keyPath[0] !== DataFrameTimeName ? keyPath[0] + sepChar : keyPath[0];
  }

  public static Component = ({ model }: SceneComponentProps<LogsJsonScene>) => {
    // const styles = getStyles(grafanaTheme)
    const { data, emptyScene, hasJsonFields, jsonFiltersSupported, menu, showLabels, showMetadata, sortOrder } =
      model.useState();
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
                    This view is built for JSON log lines, but none were detected. Switch to the Logs or Table view for
                    a better experience.
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
                  const value = valueAsString?.toString();
                  if (!value) {
                    return null;
                  }
                  return <>{value}</>;
                }}
                shouldExpandNodeInitially={(_, __, level) => level <= 2}
                labelRenderer={(keyPath, nodeType) => {
                  const nodeTypeLoc = nodeType as NodeTypeLoc;
                  if (keyPath[0] === DataFrameStructuredMetadataName) {
                    return StructuredMetadataDisplayName;
                  }
                  if (keyPath[0] === DataFrameLabelsName) {
                    return LabelsDisplayName;
                  }

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
            </div>
          )}
          {emptyScene && lineField?.values.length === 0 && <NoMatchingLabelsScene.Component model={emptyScene} />}
        </div>
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
              addFilter={this.addJsonFilter}
              keyPath={fullKeyPath}
              active={existingFilter?.operator === FilterOp.NotEqual}
            />
            <JSONFilterNestedNodeButton
              type={'exclude'}
              jsonKey={fullKey}
              addFilter={this.addJsonFilter}
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
    const existingVariableType = this.getFilterVariableTypeFromPath(keyPath);

    if (existingVariableType === VAR_FIELDS) {
      const { fullKeyPath } = this.getFullKeyPath(keyPath);
      const fullKey = getJsonKey(fullKeyPath);
      const jsonParserProp = jsonParserPropsMap.get(fullKey);
      const existingJsonFilter =
        jsonParserProp &&
        fieldsVar.state.filters.find(
          (f) => f.key === jsonParserProp?.key && getValueFromFieldsFilter(f).value === value
        );

      return (
        <span className={styles.labelButtonsWrap}>
          {jsonFiltersSupported && existingVariableType === VAR_FIELDS && (
            <>
              <JSONFilterValueButton
                label={label}
                value={value}
                fullKeyPath={fullKeyPath}
                fullKey={fullKey}
                addFilter={this.addJsonFilter}
                existingFilter={existingJsonFilter}
                type={'include'}
              />
              <JSONFilterValueButton
                label={label}
                value={value}
                fullKeyPath={fullKeyPath}
                fullKey={fullKey}
                addFilter={this.addJsonFilter}
                existingFilter={existingJsonFilter}
                type={'exclude'}
              />
            </>
          )}
          <strong className={styles.labelWrap}>{this.getKeyPathString(keyPath)}</strong>
        </span>
      );
    }

    const existingVariable = getAdHocFiltersVariable(existingVariableType, this);
    const existingFilter = existingVariable.state.filters.filter(
      (filter) => filter.key === label.toString() && filter.value === value
    );

    return (
      <span className={styles.labelButtonsWrap}>
        <FilterValueButton
          label={label.toString()}
          value={value}
          variableType={existingVariableType}
          addFilter={this.addFilter}
          existingFilter={existingFilter.find((filter) => filter.operator === FilterOp.Equal)}
          type={'include'}
        />
        <FilterValueButton
          label={label.toString()}
          value={value}
          variableType={existingVariableType}
          addFilter={this.addFilter}
          existingFilter={existingFilter.find((filter) => filter.operator === FilterOp.NotEqual)}
          type={'exclude'}
        />
        <strong className={styles.labelWrap}>{this.getKeyPathString(keyPath)}</strong>
      </span>
    );
  };

  private getFilterVariableTypeFromPath = (keyPath: ReadonlyArray<string | number>): InterpolatedFilterType => {
    if (keyPath[1] === DataFrameStructuredMetadataName) {
      if (keyPath[0] === LEVEL_VARIABLE_VALUE) {
        return VAR_LEVELS;
      }
      return VAR_METADATA;
    } else if (keyPath[1] === DataFrameLabelsName) {
      return VAR_LABELS;
    } else {
      return VAR_FIELDS;
    }
  };

  /**
   * Creates the dataframe consumed by the viz
   */
  private transformDataFrame(newState: SceneDataState) {
    const dataFrame = getLogsPanelFrame(newState.data);
    const time = dataFrame?.fields.find((field) => field.type === FieldType.time);

    const labelsField: Field<Record<string, string>> | undefined = dataFrame?.fields.find(
      (field) => field.type === FieldType.other && isLabelsField(field.name)
    );
    const labelTypesField: Field<Record<string, LabelType>> | undefined = dataFrame?.fields.find(
      (field) => field.type === FieldType.other && isLabelTypesField(field.name)
    );

    const timeZone = getTimeZone();
    if (newState.data) {
      const isRerooted = getLineFormatVariable(this).state.filters.length > 0;

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

                      const rawLabels = labelsField?.values?.[i];
                      const labelsTypes = labelTypesField?.values?.[i];
                      let structuredMetadata: Record<string, string> = {};
                      let indexedLabels: Record<string, string> = {};

                      if (!isRerooted && rawLabels && labelsTypes) {
                        const labelKeys = Object.keys(rawLabels);
                        labelKeys.forEach((label) => {
                          if (LABELS_TO_REMOVE.includes(label)) {
                          } else if (labelsTypes[label] === LabelType.StructuredMetadata) {
                            // @todo can structured metadata be JSON? detected_fields won't tell us if it were
                            structuredMetadata[label] = rawLabels[label];
                          } else if (labelsTypes[label] === LabelType.Indexed) {
                            indexedLabels[label] = rawLabels[label];
                          }
                        });
                      }
                      const line: Record<string, Record<string, string> | string> = {
                        [DataFrameLineName]: parsed,
                        [DataFrameTimeName]: renderJSONVizTimeStamp(time?.values?.[i], timeZone),
                      };
                      if (this.state.showLabels && Object.keys(indexedLabels).length > 0) {
                        line[DataFrameLabelsName] = indexedLabels;
                      }
                      if (this.state.showMetadata && Object.keys(structuredMetadata).length > 0) {
                        line[DataFrameStructuredMetadataName] = structuredMetadata;
                      }

                      return line;
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
  container: css({
    display: 'flex',
    flexDirection: 'row-reverse',
    height: '100%',
    paddingBottom: theme.spacing(1),
    paddingRight: theme.spacing(1),
  }),
  JSONTreeWrap: css`
    font-family: ${theme.typography.fontFamilyMonospace};
    // override css variables
    --json-tree-align-items: flex-start;
    --json-tree-label-color: ${theme.colors.text.secondary};
    --json-tree-label-value-color: ${theme.colors.text.primary};
    --json-tree-arrow-color: ${theme.colors.secondary.contrastText};
    --json-tree-ul-root-padding: 0 0 ${theme.spacing(2)} 0;

    overflow: auto;
    height: 100%;
    width: 100%;
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
});
