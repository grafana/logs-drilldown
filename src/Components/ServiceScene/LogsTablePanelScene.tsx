import React from 'react';

import { css } from '@emotion/css';

import { FieldConfig, FieldConfigSource, GrafanaTheme2, LogsSortOrder, shallowCompare } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  DeepPartial,
  FieldConfigOverridesBuilder,
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
import { AdHocFilterItem, PanelContext, useStyles2 } from '@grafana/ui';

import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { areArraysEqual, areArraysStrictlyEqual } from '../../services/comparison';
import { getAllLabelsFromDataFrame } from '../../services/labels';
import { setControlsExpandedStateFromLocalStorage } from '../../services/scenes';
import { getBooleanLogOption, getLogOption, setDisplayedFieldsInStorage, setLogOption } from '../../services/store';
import { clearVariables } from '../../services/variableHelpers';
import { PanelMenu } from '../Panels/PanelMenu';
import { DEFAULT_URL_COLUMNS, DETECTED_LEVEL, LEVEL } from '../Table/constants';
import { addToFilters } from './Breakdowns/AddToFiltersButton';
import { NoMatchingLabelsScene } from './Breakdowns/NoMatchingLabelsScene';
import { LogOptionsScene, OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME } from './LogOptionsScene';
import { LogsListScene } from './LogsListScene';
import { ErrorType, LogsPanelError } from './LogsPanelError';
import { ServiceScene } from './ServiceScene';
import { getVariableForLabel } from 'services/fields';
import { FilterOp } from 'services/filterTypes';
import { logger } from 'services/logger';
import { DATAPLANE_BODY_NAME_LEGACY, DATAPLANE_LINE_NAME } from 'services/logsFrame';
import { setTableFieldOverrides, storeTableFieldConfig } from 'services/logsTable';
import { narrowLogsSortOrder, unknownToStrings } from 'services/narrowing';
import { runSceneQueries } from 'services/query';

interface LogsTablePanelSceneState extends SceneObjectState {
  canClearFilters?: boolean;
  emptyScene?: NoMatchingLabelsScene;
  error?: string;
  errorType?: ErrorType;
  isDisabledLineState: boolean;
  menu?: PanelMenu;
  panel?: VizPanel<Options, {}>;
  sortOrder: LogsSortOrder;
}
export class LogsTablePanelScene extends SceneObjectBase<LogsTablePanelSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: ['sortOrder'],
  });

  constructor(state: Partial<LogsTablePanelSceneState>) {
    super({
      ...state,
      sortOrder: getLogOption<LogsSortOrder>('sortOrder', LogsSortOrder.Descending),
      isDisabledLineState: false,
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

  handleSortChange = (newOrder: LogsSortOrder) => {
    if (newOrder === this.state.sortOrder) {
      return;
    }
    setLogOption('sortOrder', newOrder);
    runSceneQueries(this);
    this.setState({ sortOrder: newOrder });
  };

  protected onOptionsChange(options: DeepPartial<Options>, prevOptions: DeepPartial<Options>) {
    // todo: Update after Grafana >= 13.1
    if ('wrapText' in options && 'wrapText' in prevOptions && options.wrapText !== prevOptions.wrapText) {
      setLogOption('wrapText', Boolean(options.wrapText));
    }
    if (options.sortOrder && options.sortOrder !== this.state.sortOrder) {
      this.handleSortChange(options.sortOrder);
    }
    if (options.displayedFields) {
      this.updateDisplayedFields(options.displayedFields);
    }
  }

  public onActivate() {
    const parentScene = this.getParentScene();
    const panelBuilder = new VizConfigBuilder<Options, {}>('logstable', pluginVersion, () => ({
      ...defaultOptions,
      sortOrder: this.state.sortOrder,
      displayedFields: parentScene.state.displayedFields,
      wrapText: getBooleanLogOption('wrapText', true),
    }));

    panelBuilder.setOverrides((builder: FieldConfigOverridesBuilder<FieldConfig>) => {
      setTableFieldOverrides(builder, this);
    });

    const panel = new VizPanel({ ...panelBuilder.build() });
    const defaultOnFieldConfigChange = panel.onFieldConfigChange.bind(panel);
    panel.onFieldConfigChange = (fieldConfigUpdate: FieldConfigSource, replace?: boolean) => {
      storeTableFieldConfig(fieldConfigUpdate, this);
      defaultOnFieldConfigChange(fieldConfigUpdate, replace);
    };

    panel.setState({
      extendPanelContext: (_, context) => this.extendLogsTableContext(context),
    });

    panel.subscribeToState((newState, prevState) => {
      if (!shallowCompare(newState.options, prevState.options)) {
        this.onOptionsChange(newState.options, prevState.options);
      }
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

    this._subs.add(
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

  private extendLogsTableContext = (context: PanelContext) => {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    context.onAddAdHocFilter = ({ value, key, operator }: AdHocFilterItem) => {
      const frame = serviceScene.state.$data?.state?.data?.series?.[0];
      const variableType = getVariableForLabel(frame, key, serviceScene);

      const operation = operator === FilterOp.Equal ? 'toggle' : 'exclude';

      addToFilters(key, value, operation, this, variableType);

      reportAppInteraction(
        USER_EVENTS_PAGES.service_details,
        USER_EVENTS_ACTIONS.service_details.logs_detail_filter_applied,
        {
          action: operation,
          filterType: variableType,
          key,
        }
      );
    };
  };
  private getParentScene() {
    return sceneGraph.getAncestor(this, LogsListScene);
  }

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

    // Sync displayed fields and remove urlColumns (deprecated)
    if (urlColumns.length > 0) {
      parentModel.setState({
        displayedFields: Array.from(new Set([...urlColumns])),
      });
      locationService.partial({ urlColumns: null }, true);
    }
  };

  // Update displayed fields in the parent scene
  updateDisplayedFields = (displayedFields: string[]) => {
    const parentModel = this.getParentScene();

    if (!areArraysEqual(displayedFields, parentModel.state.displayedFields)) {
      parentModel.setState({
        displayedFields: displayedFields,
      });
      setDisplayedFieldsInStorage(this, displayedFields, true);
    }
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
    const { error, errorType, canClearFilters, panel } = model.useState();

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
