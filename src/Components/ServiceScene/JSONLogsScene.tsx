import { DataFrame, LoadingState, LogsSortOrder, PanelData } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneQueryRunner,
} from '@grafana/scenes';

import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import {
  clearJSONParserFields,
  getDetectedFieldsJSONPathField,
  getDetectedFieldsParserField,
} from '../../services/fields';
import { preProcessJSONDataFrame } from '../../services/JSONDataFrame';
import { narrowLogsSortOrder } from '../../services/narrowing';
import { getPrettyQueryExpr } from '../../services/scenes';
import { clearVariables } from '../../services/variableHelpers';
import { PanelMenu } from '../Panels/PanelMenu';
import { NoMatchingLabelsScene } from './Breakdowns/NoMatchingLabelsScene';
import LogsJSONComponent from './JSONPanel/LogsJSONComponent';
import { getDetectedFieldsFrameFromQueryRunnerState, ServiceScene } from './ServiceScene';
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

interface JSONLogsSceneState extends SceneObjectState {
  data?: PanelData;
  emptyScene?: NoMatchingLabelsScene;
  hasHighlight: boolean;
  hasJSONFields?: boolean;
  hasLabels: boolean;
  hasMetadata: boolean;
  // While we still support loki versions that don't have https://github.com/grafana/loki/pull/16861, we need to disable filters for folks with older loki
  // If undefined, we haven't detected the loki version yet; if false, jsonPath (loki 3.5.0) is not supported
  JSONFiltersSupported: boolean | null;
  menu?: PanelMenu;
  rawFrame?: DataFrame;
  sortOrder: LogsSortOrder;
  wrapLogMessage: boolean;
}

export type NodeType = 'Array' | 'Boolean' | 'Custom' | 'Number' | 'Object' | 'String';

export const JSONDataFrameTimeName = 'Time';
export const JSONDataFrameLineName = 'Line';
export const JSONStructuredMetadataDisplayName = 'Metadata';
export const JSONLabelsDisplayName = 'Labels';
export const JSONDataFrameStructuredMetadataName = '__Metadata';
export const JSONDataFrameLinksName = '__Links';
export const JSONLinksDisplayName = 'Links';
export const JSONDataFrameLabelsName = '__Labels';
export const JSONVizRootName = 'root';

export class JSONLogsScene extends SceneObjectBase<JSONLogsSceneState> {
  public static Component = LogsJSONComponent;
  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: ['sortOrder', 'wrapLogMessage'],
  });

  constructor(state: Partial<JSONLogsSceneState>) {
    super({
      ...state,
      hasHighlight: getJSONHighlightState(),
      hasLabels: getJSONLabelsState(),
      hasMetadata: getJSONMetadataState(),
      sortOrder: getLogOption<LogsSortOrder>('sortOrder', LogsSortOrder.Descending),
      wrapLogMessage: getBooleanLogOption('wrapLogMessage', true),
      JSONFiltersSupported: null,
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
      let state: Partial<JSONLogsSceneState> = {};

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
      logger.error(e, { msg: 'JSONLogsScene: updateFromUrl unexpected error' });
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
      this.updateJSONDataFrame($data.state.data);
    }

    this._subs.add(
      $data.subscribeToState((newState) => {
        if (newState.data?.state === LoadingState.Done) {
          this.updateJSONDataFrame(newState.data);
        }
      })
    );

    clearJSONParserFields(this);

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
        if (
          $data.state.data &&
          (newState.hasMetadata !== prevState.hasMetadata || newState.hasLabels !== prevState.hasLabels)
        ) {
          this.updateJSONDataFrame($data.state.data);
        }
      })
    );

    reportAppInteraction(USER_EVENTS_PAGES.service_details, USER_EVENTS_ACTIONS.service_details.visualization_init, {
      viz: 'json',
    });
  }
  private updateJSONDataFrame(panelData: PanelData) {
    this.setState(preProcessJSONDataFrame(panelData, this));
  }

  /**
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
        hasJSONFields: true,
        JSONFiltersSupported:
          getDetectedFieldsJSONPathField(detectedFieldFrame)?.values.some((v) => v !== undefined) ?? null,
      });
    } else {
      this.setState({
        hasJSONFields: false,
      });
    }
  }
}

/**
 * Formats key from keypath
 */
export function getKeyPathString(keyPath: KeyPath, sepChar = ':') {
  return keyPath[0] !== JSONDataFrameTimeName ? keyPath[0] + sepChar : keyPath[0];
}
