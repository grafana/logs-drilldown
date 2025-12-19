import React from 'react';

import { css } from '@emotion/css';

import { LoadingState, PanelData, shallowCompare } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  SceneComponentProps,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneTimeRangeLike,
} from '@grafana/scenes';
import { Options } from '@grafana/schema/dist/esm/raw/composable/logs/panelcfg/x/LogsPanelCfg_types.gen';

import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { areArraysEqual, areArraysStrictlyEqual } from '../../services/comparison';
import { logger } from '../../services/logger';
import { narrowLogsVisualizationType, narrowSelectedTableRow, unknownToStrings } from '../../services/narrowing';
import { getRouteParams } from '../../services/routing';
import { getLabelsVariable } from '../../services/variableGetters';
import { getVariablesThatCanBeCleared } from '../../services/variableHelpers';
import { IndexScene } from '../IndexScene/IndexScene';
import { LogLineState } from '../Table/Context/TableColumnsContext';
import { SelectedTableRow } from '../Table/LogLineCellComponent';
import { ActionBarScene } from './ActionBarScene';
import { JSONLogsScene } from './JSONLogsScene';
import { LineFilterScene } from './LineFilter/LineFilterScene';
import { LineLimitScene } from './LineLimitScene';
import { ErrorType } from './LogsPanelError';
import { LogsPanelScene } from './LogsPanelScene';
import { LogsTableScene } from './LogsTableScene';
import { LogsVolumePanel, logsVolumePanelKey } from './LogsVolume/LogsVolumePanel';
import { ServiceScene } from './ServiceScene';
import { isEmptyLogsResult } from 'services/logsFrame';
import {
  getBooleanLogOption,
  getDisplayedFieldsInStorage,
  getExplorationPrefixForLabelValue,
  getLogsVisualizationType,
  getLogsVolumeOption,
  LogsVisualizationType,
  setLogsVisualizationType,
} from 'services/store';

export interface LogsListSceneState extends SceneObjectState {
  $timeRange?: SceneTimeRangeLike;
  canClearFilters?: boolean;
  controlsExpanded: boolean;
  // The currently displayed fields currently in the logs panel
  displayedFields: string[];
  error?: string;
  errorType?: ErrorType;
  lineFilter?: string;
  loading?: boolean;
  logsVolumeCollapsedByError?: boolean;
  // Displayed fields set by the otelLogsFormatting feature
  otelDisplayedFields: string[];
  panel?: SceneFlexLayout;
  selectedLine?: SelectedTableRow;
  tableLogLineState?: LogLineState;
  urlColumns?: string[];
  // Are the displayed fields set by the user
  userDisplayedFields: boolean;
  visualizationType: LogsVisualizationType;
}

export class LogsListScene extends SceneObjectBase<LogsListSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: [
      'urlColumns',
      'selectedLine',
      'visualizationType',
      'displayedFields',
      'tableLogLineState',
      'userDisplayedFields',
    ],
  });

  private logsPanelScene?: LogsPanelScene = undefined;

  constructor(state: Partial<LogsListSceneState>) {
    super({
      ...state,
      displayedFields: [],
      userDisplayedFields: false,
      otelDisplayedFields: [],
      visualizationType: getLogsVisualizationType(),
      // @todo true when over 1200? getDefaultControlsExpandedMode(containerElement ?? null)
      controlsExpanded: getBooleanLogOption('controlsExpanded', false),
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  public static Component = ({ model }: SceneComponentProps<LogsListScene>) => {
    const { panel } = model.useState();

    if (!panel) {
      return;
    }

    return (
      <div className={styles.panelWrapper}>
        <panel.Component model={panel} />
      </div>
    );
  };

  getUrlState() {
    const urlColumns = this.state.urlColumns ?? [];
    const selectedLine = this.state.selectedLine;
    const visualizationType = this.state.visualizationType;

    const previousUserAddedDisplayedFields = getDisplayedFieldsInStorage(this, true);
    const previousDisplayedFields = getDisplayedFieldsInStorage(this);
    const displayedFields =
      this.state.displayedFields ?? previousUserAddedDisplayedFields ?? previousDisplayedFields ?? [];
    const userDisplayedFields = this.state.userDisplayedFields;
    return {
      userDisplayedFields: JSON.stringify(userDisplayedFields),
      displayedFields: JSON.stringify(displayedFields),
      selectedLine: JSON.stringify(selectedLine),
      tableLogLineState: JSON.stringify(this.state.tableLogLineState),
      urlColumns: JSON.stringify(urlColumns),
      visualizationType: JSON.stringify(visualizationType),
    };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const stateUpdate: Partial<LogsListSceneState> = {};
    try {
      if (typeof values.urlColumns === 'string') {
        const decodedUrlColumns: string[] = unknownToStrings(JSON.parse(values.urlColumns));
        if (decodedUrlColumns !== this.state.urlColumns) {
          stateUpdate.urlColumns = decodedUrlColumns;
        }
      }
      if (typeof values.selectedLine === 'string') {
        const unknownTableRow = narrowSelectedTableRow(JSON.parse(values.selectedLine));
        if (unknownTableRow) {
          const decodedSelectedTableRow: SelectedTableRow = unknownTableRow;
          if (decodedSelectedTableRow !== this.state.selectedLine) {
            stateUpdate.selectedLine = decodedSelectedTableRow;
          }
        }
      }

      if (typeof values.visualizationType === 'string') {
        const decodedVisualizationType = narrowLogsVisualizationType(JSON.parse(values.visualizationType));
        if (decodedVisualizationType && decodedVisualizationType !== this.state.visualizationType) {
          stateUpdate.visualizationType = decodedVisualizationType;
        }
      }

      if (typeof values.displayedFields === 'string') {
        const displayedFields = unknownToStrings(JSON.parse(values.displayedFields));
        if (displayedFields && displayedFields.length) {
          stateUpdate.displayedFields = displayedFields;
        }
      }
      if (typeof values.tableLogLineState === 'string') {
        const tableLogLineState = JSON.parse(values.tableLogLineState);
        if (tableLogLineState === LogLineState.labels || tableLogLineState === LogLineState.text) {
          stateUpdate.tableLogLineState = tableLogLineState;
        }
      }

      if (typeof values.userDisplayedFields === 'string') {
        stateUpdate.userDisplayedFields = values.userDisplayedFields === 'true';
      }
    } catch (e) {
      // URL Params can be manually changed and it will make JSON.parse() fail.
      logger.error(e, { msg: 'LogsListScene: updateFromUrl unexpected error' });
    }

    if (Object.keys(stateUpdate).length) {
      this.setState(stateUpdate);
    }
  }

  clearSelectedLine() {
    this.setState({
      selectedLine: undefined,
    });
  }

  clearDisplayedFields = () => {
    // Clearing the defaults is a user action
    this.setState({ displayedFields: [], userDisplayedFields: true });
    if (this.logsPanelScene) {
      this.logsPanelScene.clearDisplayedFields();
    }
  };

  showBackendFields = () => {
    // This is technically a user action, but I think it makes sense to continue to get served the backend fields
    this.setState({ displayedFields: [], userDisplayedFields: false });
    if (this.logsPanelScene) {
      this.logsPanelScene.showBackendFields();
    }
  };

  public onActivate() {
    const searchParams = new URLSearchParams(locationService.getLocation().search);
    this.setStateFromUrl(searchParams);

    if (!this.state.panel) {
      this.updateLogsPanel();
    }

    this._subs.add(
      this.subscribeToState((newState, prevState) => {
        if (newState.visualizationType !== prevState.visualizationType) {
          this.updateLogsPanel();
          // Re-render the tabs to ensure the visualizationType type is set in the url
          const tabs = sceneGraph.findObject(this, (scene) => scene instanceof ActionBarScene);
          tabs?.forceRender();
        }
      })
    );

    this._subs.add(this.subscribeToLabelsVar(getLabelsVariable(this)));

    this.setDisplayedFieldsFromBackend();

    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    this._subs.add(
      serviceScene.subscribeToState((newState, prevState) => {
        if (!areArraysEqual(newState.backendDisplayedFields, prevState.backendDisplayedFields)) {
          this.setDisplayedFieldsFromBackend();
        }
      })
    );

    // Subscribe to logs query runner for error handling (all visualization types)
    const logsQueryRunner = serviceScene.state.$data;
    if (logsQueryRunner) {
      this._subs.add(
        logsQueryRunner.subscribeToState((newState, prevState) => {
          if (newState.data?.state === LoadingState.Error) {
            this.handleLogsError(newState.data);
          } else if (newState.data?.state === LoadingState.Done && isEmptyLogsResult(newState.data.series)) {
            this.handleNoData();
          } else if (this.state.error) {
            this.clearLogsError();
          }
        })
      );
    }
  }

  /**
   * On primary route change, we want to set displayed fields from local storage if the user has displayed fields configured for the new key/value
   * We cannot subscribe to the actual route parameters as if the route is cached the prevState is wrong and just shows a duplicate of the newState,
   * so we must subscribe to the variable that triggers the route change
   * @param labelsVar
   */
  private subscribeToLabelsVar = (labelsVar: AdHocFiltersVariable) => {
    return labelsVar.subscribeToState((newState, prevState) => {
      if (
        newState.filters?.[0]?.value !== prevState.filters?.[0]?.value ||
        newState.filters?.[0]?.keyLabel !== prevState.filters?.[0]?.keyLabel
      ) {
        const { labelName, labelValue } = getRouteParams(this);
        const newLabelHasUserDisplayFields = getDisplayedFieldsInStorage(this, true, {
          prefix: getExplorationPrefixForLabelValue(this, labelName, labelValue),
        });
        // Overwrite the current url state if we're switching to another label that the user already configured fields for
        if (newLabelHasUserDisplayFields) {
          this.setState({
            displayedFields: newLabelHasUserDisplayFields,
            urlColumns: newLabelHasUserDisplayFields,
            userDisplayedFields: true,
          });
        }
      }
    });
  };

  setDisplayedFieldsFromBackend() {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);

    // If the user has configured default columns for this query
    if (serviceScene.state.backendDisplayedFields && serviceScene.state.backendDisplayedFields.length > 0) {
      // No user displayed fields
      if (
        !this.state.userDisplayedFields &&
        !areArraysStrictlyEqual(serviceScene.state.backendDisplayedFields, this.state.displayedFields)
      ) {
        // Set default columns as displayed fields
        this.setState({ displayedFields: serviceScene.state.backendDisplayedFields });
        this.updateLogsPanel();
      }
    }
  }

  handleLogsError(data: PanelData) {
    const error = data.errors?.length ? data.errors[0] : data.error;
    const errorResponse = error?.message;
    if (errorResponse) {
      logger.error(new Error('Logs Panel error'), {
        msg: errorResponse,
        status: error.statusText ?? 'N/A',
        type: error.type ?? 'N/A',
      });
    }

    let errorMessage = 'Unexpected error response. Please review your filters or try a different time range.';
    if (errorResponse?.includes('parse error')) {
      errorMessage =
        'Logs could not be retrieved due to invalid filter parameters. Please review your filters and try again.';
    } else if (errorResponse?.includes('response larger than the max message size')) {
      errorMessage =
        'The response is too large to process. Try narrowing your search or using filters to reduce the data size.';
    } else if (errorResponse?.toLowerCase().includes('max entries limit')) {
      errorMessage = 'Max entries limit per query exceeded. Please review your "Line limit" setting and try again.';
    }

    this.showLogsError(errorMessage);
  }

  handleNoData() {
    if (this.state.canClearFilters) {
      this.showLogsError(
        'No logs match your search. Please review your filters or try a different time range.',
        'no-logs'
      );
    } else {
      this.showLogsError(
        'No logs match your search. Please try a with different labels or an alternative time range.',
        'no-logs'
      );
    }
  }

  showLogsError(error: string, errorType: ErrorType = 'other') {
    const logsVolumeCollapsedByError = this.state.logsVolumeCollapsedByError ?? !getLogsVolumeOption('collapsed');
    const indexScene = sceneGraph.getAncestor(this, IndexScene);
    const clearableVariables = getVariablesThatCanBeCleared(indexScene);
    const canClearFilters = clearableVariables.length > 0;

    this.setState({ canClearFilters, error, errorType, logsVolumeCollapsedByError });

    // Recreate the panel with the new error state
    this.updateLogsPanel();

    if (logsVolumeCollapsedByError) {
      const logsVolume = sceneGraph.findByKeyAndType(this, logsVolumePanelKey, LogsVolumePanel);
      logsVolume?.state.panel?.setState({ collapsed: true });
    }
  }

  clearLogsError() {
    if (this.state.logsVolumeCollapsedByError) {
      const logsVolume = sceneGraph.findByKeyAndType(this, logsVolumePanelKey, LogsVolumePanel);
      logsVolume?.state.panel?.setState({ collapsed: false });
    }

    this.setState({ error: undefined, errorType: undefined, logsVolumeCollapsedByError: undefined });

    // Recreate the panel with the cleared error state
    this.updateLogsPanel();
  }

  /**
   * Sets the initial state from url params
   * @param searchParams
   * @private
   */
  private setStateFromUrl(searchParams: URLSearchParams) {
    const selectedLineUrl = searchParams.get('selectedLine');
    const urlColumnsUrl = searchParams.get('urlColumns');
    const vizTypeUrl = searchParams.get('visualizationType');

    /**
     * Ordering
     * 1. If the user has ever made an action for this
     * 2. Results from the backend
     * 3. URL state
     */
    const userDisplayFieldsFromStorage = getDisplayedFieldsInStorage(this, true);
    const userDisplayFieldsFromStorageString = userDisplayFieldsFromStorage
      ? JSON.stringify(userDisplayFieldsFromStorage)
      : null;
    const displayFieldsFromStorage = getDisplayedFieldsInStorage(this);
    const displayFieldsFromStorageString = displayFieldsFromStorage ? JSON.stringify(displayFieldsFromStorage) : null;

    // @todo need to clear displayedFields when changing primary label slug so we grab defaults from local storage
    const displayedFieldsUrl =
      searchParams.get('displayedFields') ?? userDisplayFieldsFromStorageString ?? displayFieldsFromStorageString;

    const userDisplayedFieldsUrl =
      searchParams.get('userDisplayedFields') ?? (userDisplayFieldsFromStorage ? 'true' : 'false');

    const tableLogLineState = searchParams.get('tableLogLineState');

    console.log('LogsListScene::setStateFromUrl', {
      urls: {
        user: searchParams.get('userDisplayedFields'),
        display: searchParams.get('displayedFields'),
      },
      output: {
        user: userDisplayedFieldsUrl,
        display: displayedFieldsUrl,
      },
      storage: {
        user: userDisplayFieldsFromStorage,
        display: displayFieldsFromStorage,
      },
    });

    this.updateFromUrl({
      displayedFields: displayedFieldsUrl,
      userDisplayedFields: userDisplayedFieldsUrl,
      selectedLine: selectedLineUrl,
      tableLogLineState,
      urlColumns: urlColumnsUrl,
      visualizationType: vizTypeUrl,
    });
  }

  public setLogsVizOption = (options: Partial<Options> = {}) => {
    if (this.logsPanelScene) {
      this.logsPanelScene.setLogsVizOption(options);
    }
  };

  public updateLogsPanel = () => {
    this.setState({
      panel: this.getVizPanel(),
    });
    // Subscribe to line filter state so we can pass the current filter between different viz
    if (this.state.panel) {
      const lineFilterScenes = sceneGraph.findDescendents(this.state.panel, LineFilterScene);
      if (lineFilterScenes.length) {
        const lineFilterScene = lineFilterScenes[0];
        this._subs.add(
          lineFilterScene.subscribeToState((newState, prevState) => {
            if (newState.lineFilter !== prevState.lineFilter) {
              this.setState({
                lineFilter: newState.lineFilter,
              });
            }
          })
        );
      }
    }
  };

  public setVisualizationType = (type: LogsVisualizationType) => {
    let extraStateChanges: Partial<LogsListSceneState> = {};

    // Clean up default displayed fields
    if (config.featureToggles.otelLogsFormatting && this.state.displayedFields.length > 0) {
      if (shallowCompare(this.state.displayedFields, this.state.otelDisplayedFields)) {
        extraStateChanges = {
          displayedFields: [],
          otelDisplayedFields: [],
        };
      }
    }

    this.setState({
      visualizationType: type,
      ...extraStateChanges,
    });

    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.logs_visualization_toggle,
      {
        visualisationType: type,
      }
    );
    setLogsVisualizationType(type);
  };

  private getVizPanel() {
    const { error, errorType, canClearFilters } = this.state;

    this.logsPanelScene = new LogsPanelScene({ error, errorType, canClearFilters });

    const children =
      this.state.visualizationType === 'logs'
        ? [
            new SceneFlexLayout({
              children: [
                new SceneFlexItem({
                  body: new LineFilterScene({ lineFilter: this.state.lineFilter }),
                  xSizing: 'fill',
                }),
                new SceneFlexItem({
                  body: new LineLimitScene({ error }),
                  xSizing: 'content',
                }),
              ],
            }),
            new SceneFlexItem({
              body: this.logsPanelScene,
              height: 'calc(100vh - 220px)',
            }),
          ]
        : this.state.visualizationType === 'json'
        ? [
            new SceneFlexLayout({
              children: [
                new SceneFlexItem({
                  body: new LineFilterScene({ lineFilter: this.state.lineFilter }),
                  xSizing: 'fill',
                }),
                new SceneFlexItem({
                  body: new LineLimitScene({ error }),
                  xSizing: 'content',
                }),
              ],
            }),
            new SceneFlexItem({
              body: new JSONLogsScene({ error, canClearFilters }),
              height: 'calc(100vh - 220px)',
            }),
          ]
        : [
            new SceneFlexLayout({
              children: [
                new SceneFlexItem({
                  body: new LineFilterScene({ lineFilter: this.state.lineFilter }),
                  xSizing: 'fill',
                }),
                new SceneFlexItem({
                  body: new LineLimitScene({ error }),
                  xSizing: 'content',
                }),
              ],
            }),
            new SceneFlexItem({
              body: new LogsTableScene({ error, canClearFilters }),
              height: 'calc(100vh - 220px)',
            }),
          ];

    return new SceneFlexLayout({
      children,
      direction: 'column',
    });
  }
}

const styles = {
  panelWrapper: css({
    // Hack to select internal div
    'section > div[class$="panel-content"]': css({
      // A components withing the Logs viz sets contain, which creates a new containing block that is not body which breaks the popover menu
      contain: 'none',
      // Prevent overflow from spilling out of parent container
      overflow: 'auto',
    }),
  }),
};
