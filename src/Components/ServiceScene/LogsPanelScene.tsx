import React, { MouseEvent } from 'react';

import { DataFrame, getValueFormat, LogRowModel } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  PanelBuilders,
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  VizPanel,
} from '@grafana/scenes';
import { LogsDedupStrategy, LogsSortOrder } from '@grafana/schema';
import { Options } from '@grafana/schema/dist/esm/raw/composable/logs/panelcfg/x/LogsPanelCfg_types.gen';
import { LoadingPlaceholder, useStyles2 } from '@grafana/ui';

import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { getVariableForLabel } from '../../services/fields';
import { LineFilterCaseSensitive, LineFilterOp } from '../../services/filterTypes';
import { logger } from '../../services/logger';
import { narrowLogsSortOrder } from '../../services/narrowing';
import {
  getBooleanLogOption,
  getDedupStrategy,
  getLogOption,
  LOG_OPTIONS_LOCALSTORAGE_KEY,
  setDedupStrategy,
  setDisplayedFields,
} from '../../services/store';
import {
  getAdHocFiltersVariable,
  getLineFiltersVariable,
  getValueFromFieldsFilter,
} from '../../services/variableGetters';
import { VAR_FIELDS, VAR_LABELS, VAR_LEVELS, VAR_METADATA } from '../../services/variables';
import { getPanelWrapperStyles, PanelMenu } from '../Panels/PanelMenu';
import { DEFAULT_URL_COLUMNS_LEVELS, DEFAULT_URL_COLUMNS } from '../Table/constants';
import { addToFilters, FilterType } from './Breakdowns/AddToFiltersButton';
import { CopyLinkButton } from './CopyLinkButton';
import { LogOptionsScene } from './LogOptionsScene';
import { LogsListScene } from './LogsListScene';
import { LogsPanelError } from './LogsPanelError';
import { LogsVolumePanel, logsVolumePanelKey } from './LogsVolume/LogsVolumePanel';
import { ServiceScene } from './ServiceScene';
import { isDedupStrategy, isLogsSortOrder } from 'services/guards';
import { logsControlsSupported } from 'services/panel';
import { runSceneQueries } from 'services/query';
import { getPrettyQueryExpr } from 'services/scenes';
import { copyText, generateLogShortlink, resolveRowTimeRangeForSharing } from 'services/text';
import { clearVariables } from 'services/variableHelpers';

interface LogsPanelSceneState extends SceneObjectState {
  body?: VizPanel<Options>;
  canClearFilters?: boolean;
  dedupStrategy: LogsDedupStrategy;
  error?: string;
  prettifyLogMessage: boolean;
  series: DataFrame[];
  sortOrder: LogsSortOrder;
  wrapLogMessage: boolean;
}

export class LogsPanelScene extends SceneObjectBase<LogsPanelSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: ['sortOrder', 'wrapLogMessage', 'prettifyLogMessage'],
  });

  constructor(state: Partial<LogsPanelSceneState>) {
    super({
      dedupStrategy: LogsDedupStrategy.none,
      prettifyLogMessage: getBooleanLogOption('prettifyLogMessage', false),
      sortOrder: getLogOption<LogsSortOrder>('sortOrder', LogsSortOrder.Descending),
      wrapLogMessage: getBooleanLogOption('wrapLogMessage', false),
      series: [],
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private setStateFromUrl() {
    const searchParams = new URLSearchParams(locationService.getLocation().search);

    this.updateFromUrl({
      prettifyLogMessage: searchParams.get('prettifyLogMessage'),
      sortOrder: searchParams.get('sortOrder'),
      wrapLogMessage: searchParams.get('wrapLogMessage'),
    });
  }

  getUrlState() {
    return {
      prettifyLogMessage: JSON.stringify(this.state.prettifyLogMessage),
      sortOrder: JSON.stringify(this.state.sortOrder),
      wrapLogMessage: JSON.stringify(this.state.wrapLogMessage),
    };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const stateUpdate: Partial<LogsPanelSceneState> = {};
    try {
      if (typeof values.sortOrder === 'string' && values.sortOrder) {
        const decodedSortOrder = narrowLogsSortOrder(JSON.parse(values.sortOrder));
        if (decodedSortOrder) {
          stateUpdate.sortOrder = decodedSortOrder;
        }
      }
      if (typeof values.prettifyLogMessage === 'string' && values.prettifyLogMessage) {
        const decodedPrettifyLogMessage = JSON.parse(values.prettifyLogMessage);
        if (typeof decodedPrettifyLogMessage === 'boolean') {
          stateUpdate.prettifyLogMessage = decodedPrettifyLogMessage;
        }
      }
      if (typeof values.wrapLogMessage === 'string' && values.wrapLogMessage) {
        const decodedWrapLogMessage = JSON.parse(values.wrapLogMessage);
        if (typeof decodedWrapLogMessage === 'boolean') {
          stateUpdate.wrapLogMessage = decodedWrapLogMessage;
          // Before controls, wrapLogMessage was synced with prettifyLogMessage
          if (!logsControlsSupported) {
            stateUpdate.prettifyLogMessage = decodedWrapLogMessage;
          }
        }
      }
    } catch (e) {
      // URL Params can be manually changed and it will make JSON.parse() fail.
      logger.error(e, { msg: 'LogsPanelScene: updateFromUrl unexpected error' });
    }

    if (Object.keys(stateUpdate).length) {
      this.setState({ ...stateUpdate });
      this.setLogsVizOption({ ...stateUpdate });
    }
  }

  public onActivate() {
    // Need viz to set options, but setting options will trigger query
    this.setStateFromUrl();

    if (getDedupStrategy(this)) {
      this.setState({
        dedupStrategy: getDedupStrategy(this),
      });
    }

    if (!this.state.body) {
      this.setState({
        body: this.getLogsPanel(),
      });
    }

    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    this._subs.add(
      serviceScene.subscribeToState((newState, prevState) => {
        if (newState.logsCount !== prevState.logsCount) {
          if (!this.state.body) {
            this.setState({
              body: this.getLogsPanel(),
            });
          } else {
            this.state.body.setState({
              title: this.getTitle(newState.logsCount),
            });
          }
        }
      })
    );

    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.visualization_init,
      {
        viz: 'logs',
      },
      true
    );
  }

  setDisplayedFields = (fields: string[]) => {
    this.setLogsVizOption({
      displayedFields: fields,
    });
    setDisplayedFields(this, fields);
    const parent = this.getParentScene();
    parent.setState({ displayedFields: fields });
  };

  onClickShowField = (field: string) => {
    const parent = this.getParentScene();
    const index = parent.state.displayedFields.indexOf(field);

    if (index === -1 && this.state.body) {
      const displayedFields = [...parent.state.displayedFields, field];
      this.setLogsVizOption({
        displayedFields,
      });
      parent.setState({ displayedFields });
      setDisplayedFields(this, displayedFields);

      reportAppInteraction(
        USER_EVENTS_PAGES.service_details,
        USER_EVENTS_ACTIONS.service_details.logs_toggle_displayed_field
      );
    }
  };

  onClickHideField = (field: string) => {
    const parent = this.getParentScene();
    const index = parent.state.displayedFields.indexOf(field);

    if (index >= 0 && this.state.body) {
      const displayedFields = parent.state.displayedFields.filter((displayedField) => field !== displayedField);
      this.setLogsVizOption({
        displayedFields,
      });
      parent.setState({ displayedFields });
      setDisplayedFields(this, displayedFields);

      reportAppInteraction(
        USER_EVENTS_PAGES.service_details,
        USER_EVENTS_ACTIONS.service_details.logs_toggle_displayed_field
      );
    }
  };

  setLogsVizOption(options: Partial<Options> = {}) {
    if (!this.state.body) {
      return;
    }
    if ('sortOrder' in options && options.sortOrder !== this.state.body.state.options.sortOrder) {
      runSceneQueries(this);
    }
    this.state.body.onOptionsChange(options);
  }

  clearDisplayedFields = () => {
    if (!this.state.body) {
      return;
    }
    this.setLogsVizOption({
      displayedFields: [],
    });
    setDisplayedFields(this, []);

    // Sync with urlColumns
    const parent = this.getParentScene();
    const urlColumns = parent.state.urlColumns;
    // Remove any default columns that are no longer in urlColumns
    parent.setState({
      urlColumns:
        urlColumns?.filter(
          (column) => DEFAULT_URL_COLUMNS.includes(column) && DEFAULT_URL_COLUMNS_LEVELS.includes(column)
        ) || [],
    });
  };

  private getParentScene() {
    return sceneGraph.getAncestor(this, LogsListScene);
  }

  private getTitle(logsCount: number | undefined) {
    const valueFormatter = getValueFormat('short');
    const formattedCount = logsCount !== undefined ? valueFormatter(logsCount, 0) : undefined;
    return formattedCount !== undefined ? `Logs (${formattedCount.text}${formattedCount.suffix?.trim()})` : 'Logs';
  }

  private getLogsPanel = () => {
    const parentModel = this.getParentScene();
    const visualizationType = parentModel.state.visualizationType;
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    const panel = PanelBuilders.logs()
      .setTitle(this.getTitle(serviceScene.state.logsCount))
      .setOption('onClickFilterLabel', this.handleLabelFilterClick)
      .setOption('onClickFilterOutLabel', this.handleLabelFilterOutClick)
      .setOption('isFilterLabelActive', this.handleIsFilterLabelActive)
      .setOption('onClickFilterString', this.handleFilterStringClick)
      .setOption('onClickFilterOutString', this.handleFilterOutStringClick)
      .setOption('onClickShowField', this.onClickShowField)
      .setOption('onClickHideField', this.onClickHideField)
      .setOption('displayedFields', parentModel.state.displayedFields)
      .setMenu(
        new PanelMenu({
          investigationOptions: { getLabelName: () => `Logs: ${getPrettyQueryExpr(serviceScene)}`, type: 'logs' },
        })
      )
      .setOption('showLogContextToggle', true)
      .setShowMenuAlways(true)
      .setOption('enableInfiniteScrolling', true)
      .setOption('onNewLogsReceived', this.updateVisibleRange)
      .setOption('logRowMenuIconsAfter', [<CopyLinkButton onClick={this.handleShareLogLineClick} key={0} />])
      .setHeaderActions(
        new LogOptionsScene({ onChangeVisualizationType: parentModel.setVisualizationType, visualizationType })
      )
      .setOption('sortOrder', this.state.sortOrder)
      .setOption('wrapLogMessage', this.state.wrapLogMessage)
      .setOption('prettifyLogMessage', this.state.prettifyLogMessage)
      .setOption('dedupStrategy', this.state.dedupStrategy);

    if (!logsControlsSupported) {
      panel.setOption('showTime', true);
    } else {
      panel
        .setOption('showTime', getBooleanLogOption('showTime', true))
        .setOption('showControls', true)
        .setOption('controlsStorageKey', LOG_OPTIONS_LOCALSTORAGE_KEY)
        .setOption('onLogOptionsChange', this.handleLogOptionsChange)
        .setOption('setDisplayedFields', this.setDisplayedFields)
        .setOption('logLineMenuCustomItems', [
          {
            label: 'Copy link to log line',
            onClick: this.handleShareLogLine,
          },
        ]);
    }

    return panel.build();
  };

  private handleLogOptionsChange = (option: keyof Options, value: string | string[] | boolean) => {
    if (option === 'sortOrder' && isLogsSortOrder(value)) {
      this.setState({ sortOrder: value });
      this.setLogsVizOption({ sortOrder: value });
    } else if (option === 'wrapLogMessage' && typeof value === 'boolean') {
      this.setState({ wrapLogMessage: value });
      this.setLogsVizOption({ wrapLogMessage: value });
    } else if (option === 'prettifyLogMessage' && typeof value === 'boolean') {
      this.setState({ prettifyLogMessage: value });
      this.setLogsVizOption({ prettifyLogMessage: value });
    } else if (option === 'dedupStrategy' && isDedupStrategy(value)) {
      setDedupStrategy(this, value);
      this.setState({ dedupStrategy: value });
      this.setLogsVizOption({ dedupStrategy: value });
    }
  };

  private updateVisibleRange = (newLogs: DataFrame[]) => {
    // Update logs count
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    serviceScene.setState({
      logsCount: newLogs[0].length,
    });

    this.setState({
      series: newLogs,
    });

    const logsVolumeScene = sceneGraph.findByKeyAndType(this, logsVolumePanelKey, LogsVolumePanel);
    logsVolumeScene.updateVisibleRange(newLogs);
  };

  private handleShareLogLineClick = (event: MouseEvent<HTMLElement>, row?: LogRowModel) => {
    if (row) {
      this.handleShareLogLine(row);
    }
  };

  private handleShareLogLine = (row: LogRowModel) => {
    if (!this.state.body) {
      return;
    }
    const parent = this.getParentScene();
    const timeRange = resolveRowTimeRangeForSharing(row);
    copyText(
      generateLogShortlink(
        'panelState',
        {
          logs: { displayedFields: parent.state.displayedFields, id: row.uid },
        },
        timeRange
      )
    );
  };

  private handleLabelFilterClick = (key: string, value: string, frame?: DataFrame) => {
    this.handleLabelFilter(key, value, frame, 'toggle');
  };

  private handleLabelFilterOutClick = (key: string, value: string, frame?: DataFrame) => {
    this.handleLabelFilter(key, value, frame, 'exclude');
  };

  private handleIsFilterLabelActive = (key: string, value: string) => {
    const labels = getAdHocFiltersVariable(VAR_LABELS, this);
    const fields = getAdHocFiltersVariable(VAR_FIELDS, this);
    const levels = getAdHocFiltersVariable(VAR_LEVELS, this);
    const metadata = getAdHocFiltersVariable(VAR_METADATA, this);

    const hasKeyValueFilter = (filter: AdHocFiltersVariable | null) => {
      return (
        filter &&
        filter.state.filters.findIndex(
          (filter) => filter.operator === '=' && filter.key === key && filter.value === value
        ) >= 0
      );
    };

    // Fields have json encoded values unlike the other variables, get the value for the matching filter and parse it before comparing
    const hasKeyValueFilterField = (filter: AdHocFiltersVariable | null) => {
      if (filter) {
        const fieldFilter = filter.state.filters.find((filter) => filter.operator === '=' && filter.key === key);

        if (fieldFilter) {
          const fieldValue = getValueFromFieldsFilter(fieldFilter, key);
          return fieldValue.value === value;
        }
      }
      return false;
    };

    return (
      hasKeyValueFilter(labels) ||
      hasKeyValueFilterField(fields) ||
      hasKeyValueFilter(levels) ||
      hasKeyValueFilter(metadata)
    );
  };

  private handleFilterOutStringClick = (value: string) => {
    const lineFiltersVar = getLineFiltersVariable(this);
    if (lineFiltersVar) {
      lineFiltersVar.setState({
        filters: [
          ...lineFiltersVar.state.filters,
          {
            key: LineFilterCaseSensitive.caseSensitive,
            keyLabel: lineFiltersVar.state.filters.length.toString(),
            operator: LineFilterOp.negativeMatch,
            value,
          },
        ],
      });
      reportAppInteraction(
        USER_EVENTS_PAGES.service_details,
        USER_EVENTS_ACTIONS.service_details.logs_popover_line_filter,
        {
          selectionLength: value.length,
        }
      );
    }
  };

  private handleFilterStringClick = (value: string) => {
    const lineFiltersVar = getLineFiltersVariable(this);
    if (lineFiltersVar) {
      lineFiltersVar.setState({
        filters: [
          ...lineFiltersVar.state.filters,
          {
            key: LineFilterCaseSensitive.caseSensitive,
            keyLabel: lineFiltersVar.state.filters.length.toString(),
            operator: LineFilterOp.match,
            value,
          },
        ],
      });
      reportAppInteraction(
        USER_EVENTS_PAGES.service_details,
        USER_EVENTS_ACTIONS.service_details.logs_popover_line_filter,
        {
          selectionLength: value.length,
        }
      );
    }
  };

  private handleLabelFilter(key: string, value: string, frame: DataFrame | undefined, operator: FilterType) {
    const variableType = getVariableForLabel(frame, key, this);
    addToFilters(key, value, operator, this, variableType);

    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.logs_detail_filter_applied,
      {
        action: operator,
        filterType: variableType,
        key,
      }
    );
  }

  public static Component = ({ model }: SceneComponentProps<LogsPanelScene>) => {
    const { body, canClearFilters, error } = model.useState();
    const styles = useStyles2(getPanelWrapperStyles);

    if (body) {
      return (
        <span className={styles.panelWrapper}>
          {!error && <body.Component model={body} />}
          {error && (
            <LogsPanelError error={error} clearFilters={canClearFilters ? () => clearVariables(body) : undefined} />
          )}
        </span>
      );
    }
    return <LoadingPlaceholder text={'Loading...'} />;
  };
}
