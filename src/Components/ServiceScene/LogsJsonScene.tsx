import React from 'react';

import { isNumber } from 'lodash';

import {
  DataFrame,
  Field,
  FieldType,
  getTimeZone,
  LoadingState,
  LogsSortOrder,
  PanelData,
  sortDataFrame,
} from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  AdHocFilterWithLabels,
  SceneDataProvider,
  SceneDataState,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneQueryRunner,
} from '@grafana/scenes';
import { Button, Icon, useStyles2 } from '@grafana/ui';

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
import { addJsonParserFieldValue, getJsonKey, LABELS_TO_REMOVE } from '../../services/filters';
import { FilterOp } from '../../services/filterTypes';
import {
  breadCrumbDelimiter,
  drillUpWrapperStyle,
  getJSONVizNestedProperty,
  getJSONVizValueLabelStyles,
  itemStringDelimiter,
  jsonLabelWrapStyles,
  renderJSONVizTimeStamp,
} from '../../services/JSONViz';
import { hasValidParentNode } from '../../services/JSONVizNodes';
import { LABEL_NAME_INVALID_CHARS } from '../../services/labels';
import { narrowLogsSortOrder } from '../../services/narrowing';
import { addCurrentUrlToHistory } from '../../services/navigate';
import { getPrettyQueryExpr } from '../../services/scenes';
import { copyText } from '../../services/text';
import {
  getAdHocFiltersVariable,
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
import CopyToClipboardButton from '../Buttons/CopyToClipboardButton';
import { PanelMenu } from '../Panels/PanelMenu';
import { addToFilters, FilterType, InterpolatedFilterType } from './Breakdowns/AddToFiltersButton';
import { NoMatchingLabelsScene } from './Breakdowns/NoMatchingLabelsScene';
import { highlightLineFilterMatches } from './JSONPanel/highlightLineFilterMatches';
import JSONFilterNestedNodeButton from './JSONPanel/JSONFilterNestedNodeButton';
import { FilterValueButton, JSONFilterValueButton } from './JSONPanel/JSONFilterValueButton';
import { addDrillUp, getFullKeyPath, setNewRootNode } from './JSONPanel/JsonRootNodeNavigation';
import LogsJsonComponent from './JSONPanel/LogsJsonComponent';
import ReRootJSONButton from './JSONPanel/ReRootJSONButton';
import { LogsListScene } from './LogsListScene';
import { getDetectedFieldsFrameFromQueryRunnerState, getLogsPanelFrame, ServiceScene } from './ServiceScene';
import { KeyPath } from '@gtk-grafana/react-json-tree';
import { logger } from 'services/logger';
import {
  getBooleanLogOption,
  getJsonHighlightVisibility,
  getJsonLabelsVisibility,
  getJsonMetadataVisibility,
  getLogOption,
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
  rawFrame?: DataFrame;
  showHighlight: boolean;
  showLabels: boolean;
  showMetadata: boolean;
  sortOrder: LogsSortOrder;
  wrapLogMessage: boolean;
}

export type NodeTypeLoc = 'Array' | 'Boolean' | 'Custom' | 'Number' | 'Object' | 'String';
export type AddJSONFilter = (keyPath: KeyPath, key: string, value: string, filterType: FilterType) => void;
export type AddMetadataFilter = (
  key: string,
  value: string,
  filterType: FilterType,
  variableType: InterpolatedFilterType
) => void;

export const JsonDataFrameTimeName = 'Time';
export const JsonDataFrameLineName = 'Line';
export const StructuredMetadataDisplayName = 'Metadata';
export const LabelsDisplayName = 'Labels';
export const JsonDataFrameStructuredMetadataName = '__Metadata';
export const JsonDataFrameLabelsName = '__Labels';
export const JsonVizRootName = 'root';

export class LogsJsonScene extends SceneObjectBase<LogsJsonSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: ['sortOrder', 'wrapLogMessage'],
  });

  constructor(state: Partial<LogsJsonSceneState>) {
    super({
      ...state,
      showHighlight: getJsonHighlightVisibility(),
      showLabels: getJsonLabelsVisibility(),
      showMetadata: getJsonMetadataVisibility(),
      sortOrder: getLogOption<LogsSortOrder>('sortOrder', LogsSortOrder.Descending),
      wrapLogMessage: getBooleanLogOption('wrapLogMessage', true),
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  public static Component = LogsJsonComponent;

  getUrlState() {
    return {
      sortOrder: JSON.stringify(this.state.sortOrder),
      wrapLogMessage: JSON.stringify(this.state.wrapLogMessage),
    };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    try {
      let state: Partial<LogsJsonSceneState> = {};

      if (typeof values.sortOrder === 'string' && values.sortOrder) {
        const decodedSortOrder = narrowLogsSortOrder(JSON.parse(values.sortOrder));
        if (decodedSortOrder) {
          state.sortOrder = decodedSortOrder;
        }
      }

      if (typeof values.wrapLogMessage === 'string' && values.wrapLogMessage) {
        const decodedWrapLogMessage = !!JSON.parse(values.wrapLogMessage);
        if (decodedWrapLogMessage) {
          state.wrapLogMessage = decodedWrapLogMessage;
        }
      }

      if (Object.keys(state).length) {
        this.setState(state);
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

  private setStateFromUrl() {
    const searchParams = new URLSearchParams(locationService.getLocation().search);

    this.updateFromUrl({
      sortOrder: searchParams.get('sortOrder'),
      wrapLogMessage: searchParams.get('wrapLogMessage'),
    });
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

      if (key !== JsonVizRootName && key !== undefined) {
        accessors.push(key);
      }
    }

    return getJSONVizNestedProperty(lineField, accessors);
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
   * @todo externalize
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

  /**
   * Formats key from keypath
   */
  private getKeyPathString(keyPath: KeyPath, sepChar = ':') {
    return keyPath[0] !== JsonDataFrameTimeName ? keyPath[0] + sepChar : keyPath[0];
  }

  /**
   * Gets re-root button and key label for root node when line format filter is active.
   * aka breadcrumbs
   */
  public renderNestedNodeButtons = () => {
    const lineFormatVar = getLineFormatVariable(this);
    const filters = lineFormatVar.state.filters;
    const rootKeyPath = [JsonDataFrameLineName, 0, JsonVizRootName];

    return (
      <>
        <span className={drillUpWrapperStyle} key={JsonVizRootName}>
          <Button
            size={'sm'}
            onClick={() => setNewRootNode(rootKeyPath, this)}
            variant={'secondary'}
            fill={'outline'}
            disabled={!filters.length}
            name={JsonVizRootName}
          >
            {JsonVizRootName}
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
                  onClick={() => addDrillUp(filter.key, this)}
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

  public renderCopyToClipboardButton(keyPath: KeyPath) {
    return <CopyToClipboardButton onClick={() => copyLogLine(keyPath, sceneGraph.getData(this))} />;
  }

  /**
   * Gets filter buttons for a nested JSON node
   */
  public renderNestedNodeFilterButtons = (
    keyPath: KeyPath,
    fieldsVar: AdHocFiltersVariable,
    jsonParserPropsMap: Map<string, AdHocFilterWithLabels>,
    lineFilters: AdHocFilterWithLabels[],
    jsonFiltersSupported?: boolean
  ) => {
    const { fullKeyPath } = getFullKeyPath(keyPath, this);
    const fullKey = getJsonKey(fullKeyPath);
    const jsonParserProp = jsonParserPropsMap.get(fullKey);
    const existingFilter =
      jsonParserProp &&
      fieldsVar.state.filters.find(
        (f) => f.key === jsonParserProp?.key && getValueFromFieldsFilter(f).value === EMPTY_VARIABLE_VALUE
      );

    let highlightedValue: string | Array<string | React.JSX.Element> = [];
    highlightedValue = highlightLineFilterMatches(lineFilters, keyPath[0].toString());

    return (
      <span className={jsonLabelWrapStyles}>
        {jsonFiltersSupported && (
          <>
            <ReRootJSONButton keyPath={keyPath} sceneRef={this} />
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
        <strong className={jsonLabelWrapStyles}>
          {highlightedValue.length ? highlightedValue : this.getKeyPathString(keyPath, '')}:
        </strong>
      </span>
    );
  };

  /**
   * Gets a value label and filter buttons
   */
  public renderValueLabel = (
    keyPath: KeyPath,
    lineField: Field<string | number>,
    fieldsVar: AdHocFiltersVariable,
    jsonParserPropsMap: Map<string, AdHocFilterWithLabels>,
    lineFilters: AdHocFilterWithLabels[],
    jsonFiltersSupported?: boolean
  ) => {
    const styles = useStyles2(getJSONVizValueLabelStyles);
    const value = this.getValue(keyPath, lineField.values)?.toString();
    const label = keyPath[0];
    const existingVariableType = this.getFilterVariableTypeFromPath(keyPath);

    let highlightedValue: string | Array<string | React.JSX.Element> = [];
    if (hasValidParentNode(keyPath)) {
      highlightedValue = highlightLineFilterMatches(lineFilters, keyPath[0].toString());
    }

    if (existingVariableType === VAR_FIELDS) {
      const { fullKeyPath } = getFullKeyPath(keyPath, this);
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

          <strong className={jsonLabelWrapStyles}>
            {highlightedValue.length ? highlightedValue : this.getKeyPathString(keyPath, '')}:
          </strong>
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
        <strong className={jsonLabelWrapStyles}>
          {highlightedValue.length ? highlightedValue : this.getKeyPathString(keyPath, '')}:
        </strong>
      </span>
    );
  };

  private getFilterVariableTypeFromPath = (keyPath: ReadonlyArray<string | number>): InterpolatedFilterType => {
    if (keyPath[1] === JsonDataFrameStructuredMetadataName) {
      if (keyPath[0] === LEVEL_VARIABLE_VALUE) {
        return VAR_LEVELS;
      }
      return VAR_METADATA;
    } else if (keyPath[1] === JsonDataFrameLabelsName) {
      return VAR_LABELS;
    } else {
      return VAR_FIELDS;
    }
  };

  /**
   * Creates the dataframe consumed by the viz
   */
  private transformDataFrame(newState: SceneDataState) {
    const rawFrame = getLogsPanelFrame(newState.data);
    const dataFrame = rawFrame
      ? sortDataFrame(rawFrame, 1, this.state.sortOrder === LogsSortOrder.Descending)
      : undefined;
    const time = dataFrame?.fields.find((field) => field.type === FieldType.time);

    const labelsField: Field<Record<string, string>> | undefined = dataFrame?.fields.find(
      (field) => field.type === FieldType.other && isLabelsField(field.name)
    );
    const labelTypesField: Field<Record<string, LabelType>> | undefined = dataFrame?.fields.find(
      (field) => field.type === FieldType.other && isLabelTypesField(field.name)
    );

    const timeZone = getTimeZone();
    if (dataFrame && newState.data) {
      const isRerooted = getLineFormatVariable(this).state.filters.length > 0;

      const transformedData: PanelData = {
        ...newState.data,
        series: [dataFrame].map((frame) => {
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
                        [JsonDataFrameLineName]: parsed,
                        [JsonDataFrameTimeName]: renderJSONVizTimeStamp(time?.values?.[i], timeZone),
                      };
                      if (this.state.showLabels && Object.keys(indexedLabels).length > 0) {
                        line[JsonDataFrameLabelsName] = indexedLabels;
                      }
                      if (this.state.showMetadata && Object.keys(structuredMetadata).length > 0) {
                        line[JsonDataFrameStructuredMetadataName] = structuredMetadata;
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
        rawFrame: dataFrame,
      });
    }
  }
}

const copyLogLine = (keyPath: KeyPath, $data: SceneDataProvider) => {
  const logLineIndex = keyPath[0];
  const dataFrame = getLogsPanelFrame($data.state.data);
  const lineField = dataFrame?.fields.find((f) => isLogLineField(f.name));
  if (isNumber(logLineIndex) && lineField) {
    const line = lineField.values[logLineIndex];
    copyText(line.toString());
  }
};
