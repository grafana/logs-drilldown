import React from 'react';

import { css } from '@emotion/css';

import { LoadingState, PanelData, shallowCompare } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import {
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
import { areArraysEqual } from '../../services/comparison';
import { logger } from '../../services/logger';
import { narrowLogsVisualizationType, narrowSelectedTableRow, unknownToStrings } from '../../services/narrowing';
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
  getDisplayedFields,
  getLogsVisualizationType,
  getLogsVolumeOption,
  LogsVisualizationType,
  setLogsVisualizationType,
} from 'services/store';

export interface LogsListSceneState extends SceneObjectState {
  $timeRange?: SceneTimeRangeLike;
  // backendDisplayedFields: string[];
  canClearFilters?: boolean;
  controlsExpanded: boolean;
  displayedFields: string[];
  error?: string;
  errorType?: ErrorType;
  lineFilter?: string;
  loading?: boolean;
  logsVolumeCollapsedByError?: boolean;
  otelDisplayedFields: string[];
  panel?: SceneFlexLayout;
  selectedLine?: SelectedTableRow;
  tableLogLineState?: LogLineState;
  urlColumns?: string[];
  visualizationType: LogsVisualizationType;
}

export class LogsListScene extends SceneObjectBase<LogsListSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: ['urlColumns', 'selectedLine', 'visualizationType', 'displayedFields', 'tableLogLineState'],
  });

  private logsPanelScene?: LogsPanelScene = undefined;

  constructor(state: Partial<LogsListSceneState>) {
    super({
      ...state,
      displayedFields: [],
      otelDisplayedFields: [],
      // backendDisplayedFields: [],
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
    const displayedFields = this.state.displayedFields ?? getDisplayedFields(this) ?? [];
    return {
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
    this.setState({ displayedFields: [] });
    if (this.logsPanelScene) {
      this.logsPanelScene.clearDisplayedFields();
    }
  };

  showDefaultFields = () => {
    this.setState({ displayedFields: [] });
    if (this.logsPanelScene) {
      this.logsPanelScene.showDefaultFields();
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

    this.setBackendDisplayedFields();

    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    this._subs.add(
      serviceScene.subscribeToState((newState, prevState) => {
        if (!areArraysEqual(newState.backendDisplayedFields, prevState.backendDisplayedFields)) {
          this.setBackendDisplayedFields();
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

  setBackendDisplayedFields(newCols?: string[], prevCols?: string[]) {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);

    // If the user has configured default columns for this query
    if (serviceScene.state.backendDisplayedFields && serviceScene.state.backendDisplayedFields.length > 0) {
      // @todo do we really need to set the state?
      // this.setState({ backendDisplayedFields: serviceScene.state.backendDisplayedFields });
      // Set default columns as default displayed fields
      console.log('backend fields changed', serviceScene.state.backendDisplayedFields);
      if (!this.state.displayedFields.length) {
        console.log('setting displayed fields');
        this.setState({ displayedFields: serviceScene.state.backendDisplayedFields });
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

  private setStateFromUrl(searchParams: URLSearchParams) {
    const selectedLineUrl = searchParams.get('selectedLine');
    const urlColumnsUrl = searchParams.get('urlColumns');
    const vizTypeUrl = searchParams.get('visualizationType');
    const displayedFieldsUrl = searchParams.get('displayedFields') ?? JSON.stringify(getDisplayedFields(this));
    const tableLogLineState = searchParams.get('tableLogLineState');

    this.updateFromUrl({
      displayedFields: displayedFieldsUrl,
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
