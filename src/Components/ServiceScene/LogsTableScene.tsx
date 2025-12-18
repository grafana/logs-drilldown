import React, { lazy, useRef } from 'react';

import { css } from '@emotion/css';

import { AdHocVariableFilter, GrafanaTheme2, LogsSortOrder } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
} from '@grafana/scenes';
import { PanelChrome, useStyles2 } from '@grafana/ui';

import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { getVariableForLabel } from '../../services/fields';
import { setControlsExpandedStateFromLocalStorage } from '../../services/scenes';
import { getLogOption, getTableLogLine, setDisplayedFields, setLogOption, setTableLogLine } from '../../services/store';
import { clearVariables } from '../../services/variableHelpers';
import { PanelMenu } from '../Panels/PanelMenu';
import { LogLineState } from '../Table/Context/TableColumnsContext';
import { LogsPanelHeaderActions } from '../Table/LogsHeaderActions';
import { addAdHocFilter } from './Breakdowns/AddToFiltersButton';
import { NoMatchingLabelsScene } from './Breakdowns/NoMatchingLabelsScene';
import { LogListControls } from './LogListControls';
import { LOG_LINE_BODY_FIELD_NAME } from './LogPanels';
import { LogsListScene } from './LogsListScene';
import { ErrorType, LogsPanelError } from './LogsPanelError';
import { getLogsPanelFrame } from './ServiceScene';
import { logger } from 'services/logger';
import { DATAPLANE_BODY_NAME, DATAPLANE_LINE_NAME_LEGACY } from 'services/logsFrame';
import { narrowLogsSortOrder } from 'services/narrowing';
import { logsControlsSupported } from 'services/panel';
import { runSceneQueries } from 'services/query';

const TableProvider = lazy(() => import('../Table/TableProvider'));

interface LogsTableSceneState extends SceneObjectState {
  canClearFilters?: boolean;
  emptyScene?: NoMatchingLabelsScene;
  error?: string;
  errorType?: ErrorType;
  isDisabledLineState: boolean;
  menu?: PanelMenu;
  sortOrder: LogsSortOrder;
}
export class LogsTableScene extends SceneObjectBase<LogsTableSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: ['sortOrder'],
  });

  constructor(state: Partial<LogsTableSceneState>) {
    super({
      ...state,
      sortOrder: getLogOption<LogsSortOrder>('sortOrder', LogsSortOrder.Descending),
      isDisabledLineState: false,
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
      logger.error(e, { msg: 'LogsTableScene: updateFromUrl unexpected error' });
    }
  }

  public onActivate() {
    this.setState({
      emptyScene: new NoMatchingLabelsScene({ clearCallback: () => clearVariables(this) }),
      menu: new PanelMenu({ addInvestigationsLink: false }),
    });
    setControlsExpandedStateFromLocalStorage(this.getParentScene());
    this.setStateFromUrl();

    // Subscribe to location changes to detect URL parameter changes
    this._subs.add(
      locationService.getHistory().listen(() => {
        this.subscribeFromUrl();
      })
    );

    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.visualization_init,
      {
        viz: 'table',
      },
      true
    );
  }

  private getParentScene() {
    return sceneGraph.getAncestor(this, LogsListScene);
  }

  subscribeFromUrl = () => {
    const parentModel = this.getParentScene();
    const displayedFields = parentModel.state.displayedFields ?? [];
    console.log('displayedFields', displayedFields);

    // If body or line is in the displayed fields, show the line state controls
    if (displayedFields.includes(DATAPLANE_BODY_NAME) || displayedFields.includes(DATAPLANE_LINE_NAME_LEGACY)) {
      this.setState({ isDisabledLineState: true });
    } else {
      this.setState({ isDisabledLineState: false });
    }
  };

  // Update displayed fields in the parent scene and URL
  // Note: columns are already correctly formatted by handleSetColumns in TableColumnsContext
  // (mapped to canonical names and with only selected defaults included)
  updateDisplayedFields = (columns: string[]) => {
    const parentModel = this.getParentScene();

    // Check if body field is present
    const hasBodyField = columns.includes(LOG_LINE_BODY_FIELD_NAME);
    if (hasBodyField) {
      this.setState({ isDisabledLineState: true });
    } else {
      this.setState({ isDisabledLineState: false });
    }

    // Use columns as-is - they're already correctly formatted by handleSetColumns
    // (mapped to canonical names like 'Time', '___LOG_LINE_BODY___', etc. and only include selected defaults)
    const newDisplayedFields = Array.from(new Set(columns));

    // sync state displayedFields for LogsPanelScene
    parentModel.setState({
      displayedFields: newDisplayedFields,
    });
    // sync LocalStorage displayedFields for Go to explore
    setDisplayedFields(this, newDisplayedFields);
  };

  handleSortChange = (newOrder: LogsSortOrder) => {
    if (newOrder === this.state.sortOrder) {
      return;
    }
    setLogOption('sortOrder', newOrder);
    runSceneQueries(this);
    this.setState({ sortOrder: newOrder });
  };

  onLineStateClick = () => {
    const parentModel = sceneGraph.getAncestor(this, LogsListScene);
    const { tableLogLineState } = parentModel.state;
    parentModel.setState({
      tableLogLineState: tableLogLineState === LogLineState.text ? LogLineState.labels : LogLineState.text,
    });
    // Set table log line state in local storage
    setTableLogLine(tableLogLineState === LogLineState.text ? LogLineState.labels : LogLineState.text);
  };

  public static Component = ({ model }: SceneComponentProps<LogsTableScene>) => {
    const styles = useStyles2(getStyles);
    // Get state from parent model
    const parentModel = sceneGraph.getAncestor(model, LogsListScene);
    const { error, errorType, canClearFilters } = model.useState();
    const { data } = sceneGraph.getData(model).useState();
    const { selectedLine, tableLogLineState, displayedFields, visualizationType } = parentModel.useState();
    const { emptyScene, menu, sortOrder } = model.useState();

    // Get time range
    const timeRange = sceneGraph.getTimeRange(model);
    const { value: timeRangeValue } = timeRange.useState();

    const dataFrame = getLogsPanelFrame(data);

    // Define callback function to update filters in react
    const addFilter = (filter: AdHocVariableFilter) => {
      const variableType = getVariableForLabel(dataFrame, filter.key, model);
      addAdHocFilter(filter, parentModel, variableType);
    };

    // Get reference to panel wrapper so table knows how much space it can use to render
    const panelWrap = useRef<HTMLDivElement>(null);

    // Define callback function to update displayed fields in react
    const setDisplayedFields = (columns: string[]) => {
      // sync table columns with log panel displayed fields
      model.updateDisplayedFields(columns);
    };

    const setUrlTableBodyState = (logLineState: LogLineState) => {
      parentModel.setState({ tableLogLineState: logLineState });
    };

    const clearSelectedLine = () => {
      if (parentModel.state.selectedLine) {
        parentModel.clearSelectedLine();
      }
    };

    const controlsExpanded = parentModel.state.controlsExpanded;

    return (
      <div className={styles.panelWrapper} ref={panelWrap}>
        {!error && (
          <>
            {/* @ts-expect-error todo: fix this when https://github.com/grafana/grafana/issues/103486 is done*/}
            <PanelChrome
              loadingState={data?.state}
              title={'Logs'}
              menu={menu ? <menu.Component model={menu} /> : undefined}
              showMenuAlways={true}
              actions={
                <LogsPanelHeaderActions vizType={visualizationType} onChange={parentModel.setVisualizationType} />
              }
            >
              <div className={styles.container}>
                {logsControlsSupported && dataFrame && dataFrame.length > 0 && (
                  <LogListControls
                    controlsExpanded={controlsExpanded}
                    onExpandControlsClick={() => {
                      parentModel.setState({ controlsExpanded: !controlsExpanded });
                      setLogOption('controlsExpanded', !controlsExpanded);
                    }}
                    sortOrder={sortOrder}
                    onSortOrderChange={model.handleSortChange}
                    onLineStateClick={model.onLineStateClick}
                    // "Auto" defaults to display "show text"
                    lineState={tableLogLineState ?? getTableLogLine() ?? LogLineState.text}
                    disabledLineState={!model.state.isDisabledLineState}
                  />
                )}
                {dataFrame && (
                  <TableProvider
                    controlsExpanded={controlsExpanded}
                    panelWrap={panelWrap}
                    addFilter={addFilter}
                    timeRange={timeRangeValue}
                    selectedLine={selectedLine}
                    displayedFields={displayedFields ?? []}
                    setDisplayedFields={setDisplayedFields}
                    dataFrame={dataFrame}
                    clearSelectedLine={clearSelectedLine}
                    setUrlTableBodyState={setUrlTableBodyState}
                    urlTableBodyState={tableLogLineState ?? getTableLogLine() ?? LogLineState.text}
                    logsSortOrder={sortOrder}
                  />
                )}
                {emptyScene && dataFrame && dataFrame.length === 0 && (
                  <NoMatchingLabelsScene.Component model={emptyScene} />
                )}
              </div>
            </PanelChrome>
          </>
        )}
        {error && (
          <LogsPanelError
            error={error}
            errorType={errorType}
            clearFilters={canClearFilters ? () => clearVariables(model) : undefined}
            sceneRef={model}
          />
        )}
      </div>
    );
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  }),
  panelWrapper: css({
    height: '100%',
    label: 'panel-wrapper-table',
    width: '100%',
  }),
});
