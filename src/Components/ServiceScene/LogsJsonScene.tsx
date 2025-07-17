import React from 'react';

import {
  DataFrame,
  Field,
  FieldType,
  getLinksSupplier,
  getTimeZone,
  LoadingState,
  LogsSortOrder,
  PanelData,
  sortDataFrame,
} from '@grafana/data';
import { getTemplateSrv, locationService } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  AdHocFilterWithLabels,
  SceneDataState,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneQueryRunner,
} from '@grafana/scenes';

import { getJsonDerivedFieldsLinks } from '../../services/derivedFields';
import {
  clearJsonParserFields,
  getDetectedFieldsJsonPathField,
  getDetectedFieldsParserField,
  isLabelsField,
  isLabelTypesField,
  isLogLineField,
} from '../../services/fields';
import { LabelType } from '../../services/fieldsTypes';
import { getJsonKey, LABELS_TO_REMOVE } from '../../services/filters';
import { addJsonFilter } from '../../services/JSONFilter';
import { getJSONVizNestedProperty, renderJSONVizTimeStamp } from '../../services/JSONViz';
import { hasFieldParentNode } from '../../services/JSONVizNodes';
import { narrowLogsSortOrder } from '../../services/narrowing';
import { getPrettyQueryExpr } from '../../services/scenes';
import {
  getAdHocFiltersVariable,
  getLineFormatVariable,
  getValueFromFieldsFilter,
} from '../../services/variableGetters';
import { clearVariables } from '../../services/variableHelpers';
import { LEVEL_VARIABLE_VALUE, VAR_FIELDS, VAR_LABELS, VAR_LEVELS, VAR_METADATA } from '../../services/variables';
import { PanelMenu } from '../Panels/PanelMenu';
import { InterpolatedFilterType } from './Breakdowns/AddToFiltersButton';
import { NoMatchingLabelsScene } from './Breakdowns/NoMatchingLabelsScene';
import { FieldNodeLabelButtons } from './JSONPanel/FieldNodeLabelButtons';
import { highlightLineFilterMatches } from './JSONPanel/highlightLineFilterMatches';
import { getFullKeyPath } from './JSONPanel/JsonRootNodeNavigation';
import LogsJsonComponent from './JSONPanel/LogsJsonComponent';
import { ValueNodeLabelButtons } from './JSONPanel/ValueNodeLabelButtons';
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
type ParsedJsonLogLineValue = string | string[] | Record<string, string> | Array<Record<string, string>>;
type ParsedJsonLogLine = Record<string, ParsedJsonLogLineValue> | Array<Record<string, string>>;

export const JsonDataFrameTimeName = 'Time';
export const JsonDataFrameLineName = 'Line';
export const StructuredMetadataDisplayName = 'Metadata';
export const LabelsDisplayName = 'Labels';
export const JsonDataFrameStructuredMetadataName = '__Metadata';
export const JsonDataFrameLinksName = '__Links';
export const JsonLinksDisplayName = 'Links';
export const JsonDataFrameLabelsName = '__Labels';
export const JsonVizRootName = 'root';

export class LogsJsonScene extends SceneObjectBase<LogsJsonSceneState> {
  public static Component = LogsJsonComponent;
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

  /**
   * @todo clean up duplicate method in /src/Components/ServiceScene/LogsTableScene.tsx
   * @param newOrder
   */
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
   * @todo move out
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
    // const styles = useStyles2(getJSONVizValueLabelStyles);
    const value = this.getValue(keyPath, lineField.values)?.toString();
    const label = keyPath[0];
    const existingVariableType = this.getFilterVariableTypeFromPath(keyPath);

    let highlightedValue: string | Array<string | React.JSX.Element> = [];
    if (this.state.showHighlight && !hasFieldParentNode(keyPath)) {
      highlightedValue = highlightLineFilterMatches(lineFilters, keyPath[0].toString());
    }

    // Field (labels, metadata) nodes
    if (hasFieldParentNode(keyPath)) {
      const existingVariable = getAdHocFiltersVariable(existingVariableType, this);
      const existingFilter = existingVariable.state.filters.filter(
        (filter) => filter.key === label.toString() && filter.value === value
      );

      return (
        <FieldNodeLabelButtons
          model={this}
          keyPath={keyPath}
          label={label}
          value={value}
          variableType={existingVariableType}
          addFilter={addJsonFilter}
          existingFilter={existingFilter}
          elements={highlightedValue}
          keyPathString={getKeyPathString(keyPath, '')}
        />
      );
    }

    const { fullKeyPath } = getFullKeyPath(keyPath, this);
    const fullKey = getJsonKey(fullKeyPath);
    const jsonParserProp = jsonParserPropsMap.get(fullKey);
    const existingJsonFilter =
      jsonParserProp &&
      fieldsVar.state.filters.find((f) => f.key === jsonParserProp?.key && getValueFromFieldsFilter(f).value === value);

    // Value nodes
    return (
      <ValueNodeLabelButtons
        jsonFiltersSupported={jsonFiltersSupported}
        label={label}
        value={value}
        fullKeyPath={fullKeyPath}
        fullKey={fullKey}
        addFilter={addJsonFilter}
        existingFilter={existingJsonFilter}
        elements={highlightedValue}
        keyPathString={getKeyPathString(keyPath, '')}
        model={this}
      />
    );
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

  // @todo move out of class
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

    const templateSrv = getTemplateSrv();
    const replace = templateSrv.replace.bind(templateSrv);

    const timeZone = getTimeZone();
    if (dataFrame && newState.data) {
      const isRerooted = getLineFormatVariable(this).state.filters.length > 0;
      const derivedFields: Field[] =
        dataFrame?.fields
          .filter((f) => f.config.links)
          .map((field) => ({ ...field, getLinks: getLinksSupplier(dataFrame, field, {}, replace) })) ?? [];

      const transformedData: PanelData = {
        ...newState.data,
        series: [dataFrame].map((frame) => {
          return {
            ...frame,
            fields: frame.fields.map((field, frameIndex) => {
              if (isLogLineField(field.name)) {
                return {
                  ...field,
                  values: field.values
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
                      const line: ParsedJsonLogLine = {
                        [JsonDataFrameLineName]: parsed,
                        [JsonDataFrameTimeName]: renderJSONVizTimeStamp(time?.values?.[i], timeZone),
                      };
                      if (this.state.showLabels && Object.keys(indexedLabels).length > 0) {
                        line[JsonDataFrameLabelsName] = indexedLabels;
                      }
                      if (this.state.showMetadata && Object.keys(structuredMetadata).length > 0) {
                        line[JsonDataFrameStructuredMetadataName] = structuredMetadata;
                      }
                      if (derivedFields !== undefined) {
                        let jsonLinks = getJsonDerivedFieldsLinks(derivedFields, i);
                        if (Object.keys(jsonLinks).length) {
                          line[JsonDataFrameLinksName] = jsonLinks;
                        }
                      }
                      return line;
                    })
                    .filter((f) => f),
                };
              }
              return field;
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

/**
 * Formats key from keypath
 */
function getKeyPathString(keyPath: KeyPath, sepChar = ':') {
  return keyPath[0] !== JsonDataFrameTimeName ? keyPath[0] + sepChar : keyPath[0];
}
