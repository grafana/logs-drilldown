import React, { useRef } from 'react';

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
  SceneQueryRunner,
} from '@grafana/scenes';
import { PanelChrome, useStyles2 } from '@grafana/ui';

import { areArraysStrictlyEqual } from '../../services/comparison';
import { getVariableForLabel } from '../../services/fields';
import { getLogOption, setDisplayedFields, setLogOption } from '../../services/store';
import { clearVariables } from '../../services/variableHelpers';
import { PanelMenu } from '../Panels/PanelMenu';
import { DEFAULT_URL_COLUMNS } from '../Table/constants';
import { LogLineState } from '../Table/Context/TableColumnsContext';
import { LogsPanelHeaderActions } from '../Table/LogsHeaderActions';
import { TableProvider } from '../Table/TableProvider';
import { addAdHocFilter } from './Breakdowns/AddToFiltersButton';
import { NoMatchingLabelsScene } from './Breakdowns/NoMatchingLabelsScene';
import { LogListControls } from './LogListControls';
import { LogsListScene } from './LogsListScene';
import { getLogsPanelFrame } from './ServiceScene';
import { logger } from 'services/logger';
import { narrowLogsSortOrder, unknownToStrings } from 'services/narrowing';
import { logsControlsSupported } from 'services/panel';

let defaultUrlColumns = DEFAULT_URL_COLUMNS;

interface LogsTableSceneState extends SceneObjectState {
  emptyScene?: NoMatchingLabelsScene;
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
    this.onActivateSyncDisplayedFieldsWithUrlColumns();
    this.setStateFromUrl();
  }

  private getParentScene() {
    return sceneGraph.getAncestor(this, LogsListScene);
  }

  // on activate sync displayed fields with url columns
  onActivateSyncDisplayedFieldsWithUrlColumns = () => {
    const searchParams = new URLSearchParams(locationService.getLocation().search);
    let urlColumnsUrl: string[] | null = [];
    try {
      urlColumnsUrl = unknownToStrings(JSON.parse(decodeURIComponent(searchParams.get('urlColumns') ?? '')));
    } catch (e) {
      console.error(e);
    }
    const parentModel = this.getParentScene();
    // Sync from url
    defaultUrlColumns = urlColumnsUrl
      ? this.urlHasDefaultUrlColumns(urlColumnsUrl)
        ? this.updateDefaultUrlColumns(urlColumnsUrl)
        : defaultUrlColumns
      : defaultUrlColumns;
    defaultUrlColumns = defaultUrlColumns.length > 0 ? defaultUrlColumns : defaultUrlColumns;
    parentModel.setState({
      urlColumns: Array.from(new Set([...defaultUrlColumns, ...parentModel.state.displayedFields])),
    });
  };

  // setUrlColumns update displayed fields in the parent scene
  updateDisplayedFields = (urlColumns: string[]) => {
    const parentModel = this.getParentScene();
    // Remove any default columns that are no longer in urlColumns, if the user has un-selected the default columns
    defaultUrlColumns = this.updateDefaultUrlColumns(urlColumns);

    // Remove any default urlColumn for displayedFields
    const newDisplayedFields = Array.from(new Set([...(urlColumns || [])])).filter(
      (field) => !defaultUrlColumns.includes(field)
    );
    // sync state displayedFields for LogsPanelScene
    parentModel.setState({
      displayedFields: newDisplayedFields,
    });
    // sync LocalStorage displayedFields for Go to explore
    setDisplayedFields(this, parentModel.state.displayedFields);
  };

  // check if url has default columns initially there are none so we need to keep default values
  urlHasDefaultUrlColumns = (urlColumns: string[]) => {
    return defaultUrlColumns.some((col) => urlColumns.includes(col));
  };

  // update defaultUrlColumns and match order
  updateDefaultUrlColumns = (urlColumns: string[]) => {
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

  onLineStateClick = () => {
    const parentModel = sceneGraph.getAncestor(this, LogsListScene);
    const { tableLogLineState } = parentModel.state;
    parentModel.setState({
      tableLogLineState: tableLogLineState === LogLineState.text ? LogLineState.labels : LogLineState.text,
    });
  };

  public static Component = ({ model }: SceneComponentProps<LogsTableScene>) => {
    const styles = useStyles2(getStyles);
    // Get state from parent model
    const parentModel = sceneGraph.getAncestor(model, LogsListScene);
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

    return (
      <div className={styles.panelWrapper} ref={panelWrap}>
        {/* @ts-expect-error todo: fix this when https://github.com/grafana/grafana/issues/103486 is done*/}
        <PanelChrome
          loadingState={data?.state}
          title={'Logs'}
          menu={menu ? <menu.Component model={menu} /> : undefined}
          showMenuAlways={true}
          actions={<LogsPanelHeaderActions vizType={visualizationType} onChange={parentModel.setVisualizationType} />}
        >
          <div className={styles.container}>
            {logsControlsSupported && dataFrame && dataFrame.length > 0 && (
              <LogListControls
                sortOrder={sortOrder}
                onSortOrderChange={model.handleSortChange}
                onLineStateClick={model.onLineStateClick}
                // "Auto" defaults to display "show text"
                lineState={tableLogLineState ?? LogLineState.labels}
              />
            )}
            {dataFrame && (
              <TableProvider
                panelWrap={panelWrap}
                addFilter={addFilter}
                timeRange={timeRangeValue}
                selectedLine={selectedLine}
                urlColumns={urlColumns ?? []}
                setUrlColumns={setUrlColumns}
                dataFrame={dataFrame}
                clearSelectedLine={clearSelectedLine}
                setUrlTableBodyState={setUrlTableBodyState}
                urlTableBodyState={tableLogLineState}
                logsSortOrder={sortOrder}
              />
            )}
            {emptyScene && dataFrame && dataFrame.length === 0 && (
              <NoMatchingLabelsScene.Component model={emptyScene} />
            )}
          </div>
        </PanelChrome>
      </div>
    );
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
  }),
  panelWrapper: css({
    height: '100%',
    label: 'panel-wrapper-table',
    width: '100%',
  }),
});
