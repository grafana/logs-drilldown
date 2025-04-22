import {
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
} from '@grafana/scenes';
import { LogsListScene } from './LogsListScene';
import { AdHocVariableFilter, GrafanaTheme2, LogsSortOrder } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { TableProvider } from '../Table/TableProvider';
import React, { useRef } from 'react';
import { Button, PanelChrome, useStyles2 } from '@grafana/ui';
import { LogsPanelHeaderActions } from '../Table/LogsHeaderActions';
import { css } from '@emotion/css';
import { addAdHocFilter } from './Breakdowns/AddToFiltersButton';
import { areArraysStrictlyEqual } from '../../services/comparison';
import { getLogsPanelFrame } from './ServiceScene';
import { getVariableForLabel } from '../../services/fields';
import { PanelMenu } from '../Panels/PanelMenu';
import { getLogOption, setDisplayedFields } from '../../services/store';
import { LogLineState } from '../Table/Context/TableColumnsContext';
import { DEFAULT_URL_COLUMNS } from '../Table/constants';
import { narrowLogsSortOrder, narrowStringsArray } from 'services/narrowing';
import { LogListControls } from './LogListControls';
import { logsControlsSupported } from 'services/panel';
import { logger } from 'services/logger';

let defaultUrlColumns = DEFAULT_URL_COLUMNS;

interface LogsTableSceneState extends SceneObjectState {
  menu?: PanelMenu;
  sortOrder: LogsSortOrder;
  isColumnManagementActive: boolean;
}
export class LogsTableScene extends SceneObjectBase<LogsTableSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: ['sortOrder'],
  });

  constructor(state: Partial<LogsTableSceneState>) {
    super({
      ...state,
      isColumnManagementActive: false,
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

  public showColumnManagementDrawer = (isActive: boolean) => {
    this.setState({
      isColumnManagementActive: isActive,
    });
  };

  public onActivate() {
    this.setState({
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
      urlColumnsUrl = narrowStringsArray(JSON.parse(decodeURIComponent(searchParams.get('urlColumns') ?? '')));
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

  public static Component = ({ model }: SceneComponentProps<LogsTableScene>) => {
    const styles = useStyles2(getStyles);
    // Get state from parent model
    const parentModel = sceneGraph.getAncestor(model, LogsListScene);
    const { data } = sceneGraph.getData(model).useState();
    const { selectedLine, urlColumns, visualizationType, tableLogLineState } = parentModel.useState();
    const { menu, isColumnManagementActive, sortOrder } = model.useState();

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
          actions={
            <>
              {!logsControlsSupported && (
                <Button onClick={() => model.showColumnManagementDrawer(true)} variant={'secondary'} size={'sm'}>
                  Manage columns
                </Button>
              )}
              <LogsPanelHeaderActions vizType={visualizationType} onChange={parentModel.setVisualizationType} />
            </>
          }
        >
          <div className={styles.container}>
            {logsControlsSupported && <LogListControls />}
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
                showColumnManagementDrawer={model.showColumnManagementDrawer}
                isColumnManagementActive={isColumnManagementActive}
                logsSortOrder={sortOrder}
              />
            )}
          </div>
        </PanelChrome>
      </div>
    );
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  panelWrapper: css({
    width: '100%',
    height: '100%',
    label: 'panel-wrapper-table',
  }),
  container: css({
    display: 'flex',
    flexDirection: 'row-reverse',
  }),
});
