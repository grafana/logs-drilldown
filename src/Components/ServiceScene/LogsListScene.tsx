import React from 'react';

import { css } from '@emotion/css';

import { openAssistant } from '@grafana/assistant';
import { LoadingState, PanelData } from '@grafana/data';
import { locationService } from '@grafana/runtime';
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
import { LogsPanelScene } from './LogsPanelScene';
import { LogsTableScene } from './LogsTableScene';
import { LogsVolumePanel, logsVolumePanelKey } from './LogsVolume/LogsVolumePanel';
import { ServiceScene } from './ServiceScene';
import { buildAssistantContext } from 'services/assistant';
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
  canClearFilters?: boolean;
  controlsExpanded: boolean;
  displayedFields: string[];
  error?: string;
  isEmptyResult?: boolean;
  lineFilter?: string;
  loading?: boolean;
  logsVolumeCollapsedByError?: boolean;
  onWhereAreMyLogs?: (() => void | Promise<void>) | null;
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
  private whereAreMyLogsHandler?: () => Promise<void>;

  constructor(state: Partial<LogsListSceneState>) {
    super({
      ...state,
      displayedFields: [],
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

  public onActivate() {
    const searchParams = new URLSearchParams(locationService.getLocation().search);
    const indexScene = sceneGraph.getAncestor(this, IndexScene);
    this.setStateFromUrl(searchParams);

    if (!this.state.panel) {
      this.updateLogsPanel();
    }

    this._subs.add(
      indexScene.subscribeToState(() => {
        if (!this.state.error || !this.state.isEmptyResult) {
          if (this.state.onWhereAreMyLogs) {
            this.whereAreMyLogsHandler = undefined;
            this.setState({ onWhereAreMyLogs: null });
          }
          return;
        }

        const handler = this.getWhereAreMyLogsHandler(indexScene, true);
        if (this.state.onWhereAreMyLogs !== handler) {
          this.setState({ onWhereAreMyLogs: handler });
        }
      })
    );

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

    // Subscribe to logs query runner for error handling (all visualization types)
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
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

    this.showLogsError({ message: errorMessage, isEmptyResult: false });
  }

  handleNoData() {
    if (this.state.canClearFilters) {
      this.showLogsError({
        isEmptyResult: true,
        message: 'No logs match your search. Please review your filters or try a different time range.',
      });
    } else {
      this.showLogsError({
        isEmptyResult: true,
        message: 'No logs match your search. Please try a different time range.',
      });
    }
  }

  showLogsError({ message, isEmptyResult }: { isEmptyResult: boolean; message: string }) {
    const logsVolumeCollapsedByError = this.state.logsVolumeCollapsedByError ?? !getLogsVolumeOption('collapsed');
    const indexScene = sceneGraph.getAncestor(this, IndexScene);
    const clearableVariables = getVariablesThatCanBeCleared(indexScene);
    const canClearFilters = clearableVariables.length > 0;

    const onWhereAreMyLogs = this.getWhereAreMyLogsHandler(indexScene, isEmptyResult);

    this.setState({
      canClearFilters,
      error: message,
      isEmptyResult,
      logsVolumeCollapsedByError,
      onWhereAreMyLogs,
    });

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

    this.whereAreMyLogsHandler = undefined;
    this.setState({
      error: undefined,
      isEmptyResult: undefined,
      logsVolumeCollapsedByError: undefined,
      onWhereAreMyLogs: null,
    });

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
    this.setState({
      visualizationType: type,
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
    const { error, canClearFilters } = this.state;

    this.logsPanelScene = new LogsPanelScene({ error, canClearFilters });

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

  private getWhereAreMyLogsHandler(indexScene: IndexScene, isEmptyResult: boolean) {
    if (
      !isEmptyResult ||
      !indexScene.state.embedded ||
      indexScene.state.embedderName !== 'Asserts' ||
      !indexScene.state.currentFiltersMatchReference ||
      !indexScene.state.isAssistantAvailable
    ) {
      this.whereAreMyLogsHandler = undefined;
      return null;
    }

    if (!this.whereAreMyLogsHandler) {
      this.whereAreMyLogsHandler = async () => {
        const context = await buildAssistantContext(indexScene);
        if (!context.length) {
          return;
        }

        openAssistant({
          origin: 'logs-drilldown-empty-results',
          prompt:
            'Investigate why the Asserts KPI drawer shows an empty logs table. Validate the label-to-log mapping and suggest next steps to restore logs visibility.',
          context,
        });
      };
    }

    return this.whereAreMyLogsHandler;
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
