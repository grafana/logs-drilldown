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
import { LABELS_TO_REMOVE } from '../../services/filters';
import { renderJSONVizTimeStamp } from '../../services/JSONViz';
import { narrowLogsSortOrder } from '../../services/narrowing';
import { getPrettyQueryExpr } from '../../services/scenes';
import { getLineFormatVariable } from '../../services/variableGetters';
import { clearVariables } from '../../services/variableHelpers';
import { PanelMenu } from '../Panels/PanelMenu';
import { NoMatchingLabelsScene } from './Breakdowns/NoMatchingLabelsScene';
import LogsJsonComponent from './JSONPanel/LogsJsonComponent';
import { getDetectedFieldsFrameFromQueryRunnerState, getLogsPanelFrame, ServiceScene } from './ServiceScene';
import { KeyPath } from '@gtk-grafana/react-json-tree';
import { logger } from 'services/logger';
import {
  getBooleanLogOption,
  getJSONHighlightState,
  getJSONLabelsState,
  getJSONMetadataState,
  getLogOption,
  setLogOption,
} from 'services/store';

interface LogsJsonSceneState extends SceneObjectState {
  data?: PanelData;
  emptyScene?: NoMatchingLabelsScene;
  hasHighlight: boolean;
  hasJsonFields?: boolean;
  hasLabels: boolean;
  hasMetadata: boolean;
  // While we still support loki versions that don't have https://github.com/grafana/loki/pull/16861, we need to disable filters for folks with older loki
  // If undefined, we haven't detected the loki version yet; if false, jsonPath (loki 3.5.0) is not supported
  jsonFiltersSupported?: boolean;
  menu?: PanelMenu;
  rawFrame?: DataFrame;
  sortOrder: LogsSortOrder;
  wrapLogMessage: boolean;
}

export type NodeType = 'Array' | 'Boolean' | 'Custom' | 'Number' | 'Object' | 'String';
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

export class JSONLogsScene extends SceneObjectBase<LogsJsonSceneState> {
  public static Component = LogsJsonComponent;
  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: ['sortOrder', 'wrapLogMessage'],
  });

  constructor(state: Partial<LogsJsonSceneState>) {
    super({
      ...state,
      hasHighlight: getJSONHighlightState(),
      hasLabels: getJSONLabelsState(),
      hasMetadata: getJSONMetadataState(),
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
      this.preProcessDataFrame($data.state);
    }

    this._subs.add(
      $data.subscribeToState((newState) => {
        if (newState.data?.state === LoadingState.Done) {
          this.preProcessDataFrame(newState);
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
        if (newState.hasMetadata !== prevState.hasMetadata || newState.hasLabels !== prevState.hasLabels) {
          this.preProcessDataFrame($data.state);
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
   * Creates the dataframe consumed by the viz
   */
  private preProcessDataFrame(newState: SceneDataState) {
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
                      if (this.state.hasLabels && Object.keys(indexedLabels).length > 0) {
                        line[JsonDataFrameLabelsName] = indexedLabels;
                      }
                      if (this.state.hasMetadata && Object.keys(structuredMetadata).length > 0) {
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
export function getKeyPathString(keyPath: KeyPath, sepChar = ':') {
  return keyPath[0] !== JsonDataFrameTimeName ? keyPath[0] + sepChar : keyPath[0];
}
