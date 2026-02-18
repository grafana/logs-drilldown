import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2, LogsSortOrder } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  DeepPartial,
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  VizConfigBuilder,
  VizPanel,
} from '@grafana/scenes';
import {
  defaultOptions,
  Options,
  pluginVersion,
} from '@grafana/schema/dist/esm/raw/composable/logstable/panelcfg/x/LogsTablePanelCfg_types.gen';
import { useStyles2 } from '@grafana/ui';

import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { areArraysEqual } from '../../services/comparison';
import { getAllLabelsFromDataFrame } from '../../services/labels';
import { setControlsExpandedStateFromLocalStorage } from '../../services/scenes';
import { getLogOption, setDisplayedFieldsInStorage } from '../../services/store';
import { clearVariables } from '../../services/variableHelpers';
import { PanelMenu } from '../Panels/PanelMenu';
import { DEFAULT_URL_COLUMNS, DETECTED_LEVEL, LEVEL } from '../Table/constants';
import { NoMatchingLabelsScene } from './Breakdowns/NoMatchingLabelsScene';
import { LogOptionsScene, OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME } from './LogOptionsScene';
import { LogsListScene } from './LogsListScene';
import { ErrorType, LogsPanelError } from './LogsPanelError';
import { logger } from 'services/logger';
import { DATAPLANE_BODY_NAME_LEGACY, DATAPLANE_LINE_NAME } from 'services/logsFrame';
import { narrowLogsSortOrder, unknownToStrings } from 'services/narrowing';

interface LogsTableSceneState extends SceneObjectState {
  canClearFilters?: boolean;
  emptyScene?: NoMatchingLabelsScene;
  error?: string;
  errorType?: ErrorType;
  isDisabledLineState: boolean;
  menu?: PanelMenu;
  panel?: VizPanel<Options, {}>;
  sortOrder: LogsSortOrder;
}
export class LogsTablePanelScene extends SceneObjectBase<LogsTableSceneState> {
  // Reference to the active panel, maybe a bad idea if they get out of sync, but the point here is you should be updating the options not the panel
  private _viz: VizPanel | null = null;

  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    // urlColumns are options.displayedFields
    keys: ['sortOrder', 'urlColumns'],
  });

  constructor(state: Partial<LogsTableSceneState>) {
    super({
      ...state,
      sortOrder: getLogOption<LogsSortOrder>('sortOrder', LogsSortOrder.Descending),
      isDisabledLineState: false,
      // @todo override from local storage
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private getPanelOptions() {
    return this.state.panel?.state.options;
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

  protected onOptionsChange(options: DeepPartial<Options>, prevOptions: DeepPartial<Options>) {
    console.log('options change', options);
  }

  public onActivate() {
    // @todo add from local storage, url
    const parentScene = this.getParentScene();
    const panelBuilder = new VizConfigBuilder<Options, {}>('logstable', pluginVersion, () => ({
      ...defaultOptions,
      // Could do url columns
      displayedFields: parentScene.state.displayedFields,
    }));

    // @todo set field defaults
    // panelBuilder.setOverrides();

    const panel = new VizPanel({ ...panelBuilder.build() });
    this._viz = panel;

    panel.subscribeToState((newState, prevState) => {
      this.onOptionsChange(newState.options, prevState.options);
    });

    panel.setState({
      showMenuAlways: true,
      menu: new PanelMenu({}),
      headerActions: new LogOptionsScene({
        onChangeVisualizationType: parentScene.setVisualizationType,
        visualizationType: parentScene.state.visualizationType,
      }),
    });

    this.setState({
      emptyScene: new NoMatchingLabelsScene({ clearCallback: () => clearVariables(this) }),
      menu: new PanelMenu({}),
      panel,
    });
    setControlsExpandedStateFromLocalStorage(this.getParentScene());
    this.setStateFromUrl();

    // Subscribe to location changes to detect URL parameter changes
    this._subs.add(
      locationService.getHistory().listen(() => {
        this.subscribeFromUrl();
      })
    );

    this.getParentScene().subscribeToState((newState, prevState) => {
      const options = this.getPanelOptions();
      if (!areArraysEqual(newState.displayedFields, prevState.displayedFields)) {
        this.state.panel?.setState({
          options: {
            ...options,
            displayedFields: newState.displayedFields,
          },
        });
      }
    });

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
    console.log('getParentScene', this);
    return sceneGraph.getAncestor(this, LogsListScene);
  }

  subscribeFromUrl = () => {
    const searchParams = new URLSearchParams(locationService.getLocation().search);
    // Check URL columns for body parameter and update isDisabledLineState accordingly
    let urlColumns: string[] | null = [];
    try {
      urlColumns = unknownToStrings(JSON.parse(decodeURIComponent(searchParams.get('urlColumns') ?? '')));

      // If body or line is in the url columns, show the line state controls
      if (urlColumns.includes(DATAPLANE_BODY_NAME_LEGACY) || urlColumns.includes(DATAPLANE_LINE_NAME)) {
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
      if (urlColumns.includes(DATAPLANE_BODY_NAME_LEGACY) || urlColumns.includes(DATAPLANE_LINE_NAME)) {
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
    if (defaultUrlColumns.includes(DATAPLANE_BODY_NAME_LEGACY) || defaultUrlColumns.includes(DATAPLANE_LINE_NAME)) {
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

  public static Component = ({ model }: SceneComponentProps<LogsTablePanelScene>) => {
    const styles = useStyles2(getStyles);
    // Get state from parent model
    // const parentModel = sceneGraph.getAncestor(model, LogsListScene);
    const { error, errorType, canClearFilters, panel } = model.useState();
    // const { displayedFields } = parentModel.useState();
    // const { data } = sceneGraph.getData(model).useState();

    // const dataFrame = getLogsPanelFrame(data);

    // Define callback function to update filters in react
    // const addFilter = (filter: AdHocVariableFilter) => {
    //   const variableType = getVariableForLabel(dataFrame, filter.key, model);
    //   addAdHocFilter(filter, parentModel, variableType);
    // };

    return (
      <div className={styles.panelWrapper}>
        {!error && panel && <panel.Component model={panel} />}
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
    height: '100%',
    flex: 1,
  }),
  tableContainer: css({
    overflow: 'hidden',
    flex: '1 1 auto',
    minWidth: 0,
  }),
  panelWrapper: css({
    height: '100%',
    label: 'panel-wrapper-table',
    width: '100%',
  }),
});
