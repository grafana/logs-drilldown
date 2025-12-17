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
import { areArraysStrictlyEqual } from '../../services/comparison';
import { getVariableForLabel } from '../../services/fields';
import { getAllLabelsFromDataFrame } from '../../services/labels';
import { setControlsExpandedStateFromLocalStorage } from '../../services/scenes';
import {
  getLogOption,
  getTableLogLine,
  setDisplayedFieldsInStorage,
  setLogOption,
  setTableLogLine,
} from '../../services/store';
import { clearVariables } from '../../services/variableHelpers';
import { PanelMenu } from '../Panels/PanelMenu';
import { DEFAULT_URL_COLUMNS, DEFAULT_URL_COLUMNS_LEVELS, DETECTED_LEVEL, LEVEL } from '../Table/constants';
import { LogLineState } from '../Table/Context/TableColumnsContext';
import { LogsPanelHeaderActions } from '../Table/LogsHeaderActions';
import { addAdHocFilter } from './Breakdowns/AddToFiltersButton';
import { NoMatchingLabelsScene } from './Breakdowns/NoMatchingLabelsScene';
import { LogListControls } from './LogListControls';
import { LogOptionsButtonsScene } from './LogOptionsButtonsScene';
import { OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME } from './LogOptionsScene';
import { LogsListScene } from './LogsListScene';
import { ErrorType, LogsPanelError } from './LogsPanelError';
import { getLogsPanelFrame, ServiceScene } from './ServiceScene';
import { logger } from 'services/logger';
import { DATAPLANE_BODY_NAME, DATAPLANE_LINE_NAME_LEGACY } from 'services/logsFrame';
import { narrowLogsSortOrder, unknownToStrings } from 'services/narrowing';
import { logsControlsSupported } from 'services/panel';
import { runSceneQueries } from 'services/query';

const TableProvider = lazy(() => import('../Table/TableProvider'));

interface LogsTableSceneState extends SceneObjectState {
  canClearFilters?: boolean;
  emptyScene?: NoMatchingLabelsScene;
  error?: string;
  errorType?: ErrorType;
  isDisabledLineState: boolean;
  logOptionsButtonsScene?: LogOptionsButtonsScene;
  menu?: PanelMenu;
  sortOrder: LogsSortOrder;
}
export class LogsTableScene extends SceneObjectBase<LogsTableSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: ['sortOrder', 'urlColumns'],
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
      logOptionsButtonsScene: new LogOptionsButtonsScene({
        mode: 'table',
        clearDisplayedFields: () => {
          setDisplayedFieldsInStorage(this, []);
          setDisplayedFieldsInStorage(this, [], true);

          // Sync with urlColumns
          const parent = this.getParentScene();
          parent.setState({
            urlColumns: [...DEFAULT_URL_COLUMNS, ...DEFAULT_URL_COLUMNS_LEVELS],
            displayedFields: [],
          });
        },
        showBackendFields: () => {
          const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
          const backendDisplayedFields = serviceScene.state.backendDisplayedFields ?? [];

          setDisplayedFieldsInStorage(this, backendDisplayedFields);
          // Clear user added state
          setDisplayedFieldsInStorage(this, null, true);

          // Sync with urlColumns
          const parent = this.getParentScene();
          // Set displayed fields
          parent.setState({ displayedFields: backendDisplayedFields, urlColumns: backendDisplayedFields });
        },
      }),
    });
    setControlsExpandedStateFromLocalStorage(this.getParentScene());
    this.setStateFromUrl();

    // Subscribe to location changes to detect URL parameter changes
    this._subs.add(
      locationService.getHistory().listen(() => {
        this.subscribeFromUrl();
      })
    );

    this.onLoadSyncDisplayedFieldsWithUrlColumns();

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
    const searchParams = new URLSearchParams(locationService.getLocation().search);
    // Check URL columns for body parameter and update isDisabledLineState accordingly
    let urlColumns: string[] | null = [];
    try {
      urlColumns = unknownToStrings(JSON.parse(decodeURIComponent(searchParams.get('urlColumns') ?? '')));

      // If body or line is in the url columns, show the line state controls
      if (urlColumns.includes(DATAPLANE_BODY_NAME) || urlColumns.includes(DATAPLANE_LINE_NAME_LEGACY)) {
        this.setState({ isDisabledLineState: true });
      } else {
        this.setState({ isDisabledLineState: false });
      }
    } catch (e) {
      console.error('Error parsing urlColumns:', e);
    }
  };

  onLoadSyncDisplayedFieldsWithUrlColumns = () => {
    const searchParams = new URLSearchParams(locationService.getLocation().search);
    let urlColumns: string[] | null = [];
    try {
      urlColumns = unknownToStrings(JSON.parse(decodeURIComponent(searchParams.get('urlColumns') ?? '')));
      // If body or line is in the url columns, show the line state controls
      if (urlColumns.includes(DATAPLANE_BODY_NAME) || urlColumns.includes(DATAPLANE_LINE_NAME_LEGACY)) {
        this.setState({ isDisabledLineState: true });
      }
    } catch (e) {
      console.error(e);
    }
    const parentModel = this.getParentScene();

    const displayedFields = parentModel.state.displayedFields.filter(
      (field) => field !== OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME
    );

    // Add displayed fields to url columns
    if (urlColumns.length > 0 && parentModel.state.displayedFields.length > 0) {
      parentModel.setState({
        urlColumns: Array.from(new Set([...urlColumns, ...displayedFields])),
      });
    }
  };

  // Update displayed fields in the parent scene
  updateDisplayedFields = (urlColumns: string[]) => {
    const parentModel = this.getParentScene();
    // Remove any default columns that are no longer in urlColumns, if the user has un-selected the default columns
    const defaultUrlColumns = this.findDefaultUrlColumns(urlColumns);
    // If body or line is in the url columns, show the line state controls
    if (defaultUrlColumns.includes(DATAPLANE_BODY_NAME) || defaultUrlColumns.includes(DATAPLANE_LINE_NAME_LEGACY)) {
      this.setState({ isDisabledLineState: true });
    } else {
      this.setState({ isDisabledLineState: false });
    }

    // Remove any default urlColumn for displayedFields
    const levelFieldName = this.hasDetectedLevel();
    const allDefaultColumns = [...defaultUrlColumns];
    if (levelFieldName) {
      allDefaultColumns.push(levelFieldName);
    }
    const newDisplayedFields = Array.from(new Set([...(urlColumns || [])])).filter(
      (field) => !allDefaultColumns.includes(field)
    );
    // sync state displayedFields for LogsPanelScene
    parentModel.setState({
      displayedFields: newDisplayedFields,
    });
    // sync LocalStorage displayedFields for Go to explore
    setDisplayedFieldsInStorage(this, parentModel.state.displayedFields);
  };

  // find defaultUrlColumns and match order
  findDefaultUrlColumns = (urlColumns: string[]) => {
    let defaultUrlColumns = DEFAULT_URL_COLUMNS;
    defaultUrlColumns = defaultUrlColumns.reduce<string[]>((acc, col) => {
      // return the column in the same index position as urlColumns
      if (urlColumns.includes(col)) {
        const urlIndex = urlColumns.indexOf(col);
        acc[urlIndex] = col;
      }
      return acc;
    }, []);

    return defaultUrlColumns;
  };

  // check if the data has a detected_level or level field
  hasDetectedLevel = () => {
    const dataProvider = sceneGraph.getData(this);
    const data = dataProvider.state.data;
    if (!data?.series?.length) {
      return null;
    }

    // Get all available labels from the series
    const allLabels = getAllLabelsFromDataFrame(data.series);

    // Check if detected_level or level exists in the labels
    if (allLabels.includes(DETECTED_LEVEL)) {
      return DETECTED_LEVEL;
    }
    if (allLabels.includes(LEVEL)) {
      return LEVEL;
    }

    return null;
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
    const { error, errorType, canClearFilters, logOptionsButtonsScene } = model.useState();
    const { data } = sceneGraph.getData(model).useState();
    const { selectedLine, tableLogLineState, urlColumns, visualizationType } = parentModel.useState();
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

    // Define callback function to update url columns in react
    const setUrlColumns = (urlColumns: string[]) => {
      if (!areArraysStrictlyEqual(urlColumns, parentModel.state.urlColumns)) {
        parentModel.setState({ urlColumns });
        // sync table urlColumns with log panel displayed fields
        model.updateDisplayedFields(urlColumns);
      }
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
                <>
                  {logOptionsButtonsScene && <logOptionsButtonsScene.Component model={logOptionsButtonsScene} />}
                  <LogsPanelHeaderActions vizType={visualizationType} onChange={parentModel.setVisualizationType} />
                </>
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
                    urlColumns={urlColumns ?? []}
                    displayFields={parentModel.state.displayedFields}
                    setUrlColumns={setUrlColumns}
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
