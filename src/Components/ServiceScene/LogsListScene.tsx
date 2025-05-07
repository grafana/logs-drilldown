import React from 'react';

import { css } from '@emotion/css';

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
import { LogLineState } from '../Table/Context/TableColumnsContext';
import { SelectedTableRow } from '../Table/LogLineCellComponent';
import { LineFilterScene } from './LineFilter/LineFilterScene';
import { LogsJsonScene } from './LogsJsonScene';
import { LogsPanelScene } from './LogsPanelScene';
import { LogsTableScene } from './LogsTableScene';
import {
  getDisplayedFields,
  getLogsVisualizationType,
  LogsVisualizationType,
  setLogsVisualizationType,
} from 'services/store';

export interface LogsListSceneState extends SceneObjectState {
  $timeRange?: SceneTimeRangeLike;
  displayedFields: string[];
  lineFilter?: string;
  loading?: boolean;
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
      visualizationType: getLogsVisualizationType(),
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
    this.setStateFromUrl(searchParams);

    if (!this.state.panel) {
      this.updateLogsPanel();
    }

    this._subs.add(
      this.subscribeToState((newState, prevState) => {
        if (newState.visualizationType !== prevState.visualizationType) {
          this.updateLogsPanel();
        }
      })
    );
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
      vizType: vizTypeUrl,
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
    this.logsPanelScene = new LogsPanelScene({});

    const children =
      this.state.visualizationType === 'logs'
        ? [
            new SceneFlexLayout({
              children: [
                new SceneFlexItem({
                  body: new LineFilterScene({ lineFilter: this.state.lineFilter }),
                  xSizing: 'fill',
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
            new SceneFlexItem({
              body: new LineFilterScene({ lineFilter: this.state.lineFilter }),
              xSizing: 'fill',
            }),
            new SceneFlexItem({
              body: new LogsJsonScene({}),
              height: 'calc(100vh - 220px)',
            }),
          ]
        : [
            new SceneFlexItem({
              body: new LineFilterScene({ lineFilter: this.state.lineFilter }),
              xSizing: 'fill',
            }),
            new SceneFlexItem({
              body: new LogsTableScene({}),
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
