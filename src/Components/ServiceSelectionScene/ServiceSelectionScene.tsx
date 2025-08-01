import React from 'react';

import { css } from '@emotion/css';
import { debounce } from 'lodash';

import {
  AdHocVariableFilter,
  DashboardCursorSync,
  DataFrame,
  dateTime,
  GrafanaTheme2,
  LoadingState,
} from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  behaviors,
  DataSourceVariable,
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneQueryRunner,
  SceneVariableSet,
  VizPanel,
} from '@grafana/scenes';
import { VariableHide } from '@grafana/schema';
import {
  DrawStyle,
  Field,
  LegendDisplayMode,
  PanelContext,
  SeriesVisibilityChangeMode,
  StackingMode,
  useStyles2,
} from '@grafana/ui';

import { areArraysEqual } from '../../services/comparison';
import { CustomConstantVariable } from '../../services/CustomConstantVariable';
import { pushUrlHandler } from '../../services/navigate';
import { getQueryRunnerFromChildren } from '../../services/scenes';
import {
  clearServiceSelectionSearchVariable,
  getAggregatedMetricsVariable,
  getDataSourceVariable,
  getLabelsVariable,
  getLabelsVariableReplica,
  getServiceSelectionPrimaryLabel,
  getServiceSelectionSearchVariable,
  setServiceSelectionPrimaryLabelKey,
} from '../../services/variableGetters';
import { IndexScene, showLogsButtonSceneKey } from '../IndexScene/IndexScene';
import { ShowLogsButtonScene } from '../IndexScene/ShowLogsButtonScene';
import { ToolbarScene } from '../IndexScene/ToolbarScene';
import { ServiceFieldSelector } from '../ServiceScene/Breakdowns/FieldSelector';
import { AddLabelToFiltersHeaderActionScene } from './AddLabelToFiltersHeaderActionScene';
import { ConfigureVolumeError } from './ConfigureVolumeError';
import { FavoriteServiceHeaderActionScene } from './FavoriteServiceHeaderActionScene';
import { NoServiceSearchResults } from './NoServiceSearchResults';
import { NoServiceVolume } from './NoServiceVolume';
import { goToLabelDrillDownLink, SelectServiceButton } from './SelectServiceButton';
import { ServiceSelectionPaginationScene } from './ServiceSelectionPaginationScene';
import { ServiceSelectionTabsScene } from './ServiceSelectionTabsScene';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { getLevelLabelsFromSeries, toggleLevelVisibility } from 'services/levels';
import { getQueryRunner, getSceneQueryRunner, setLevelColorOverrides } from 'services/panel';
import {
  buildDataQuery,
  buildVolumeQuery,
  renderLogQLLabelFilters,
  unwrapWildcardSearch,
  wrapWildcardSearch,
} from 'services/query';
import {
  addTabToLocalStorage,
  getDisplayedFieldsForLabelValue,
  getFavoriteLabelValuesFromStorage,
  getServiceSelectionPageCount,
} from 'services/store';
import {
  EXPLORATION_DS,
  LEVEL_VARIABLE_VALUE,
  SERVICE_NAME,
  SERVICE_UI_LABEL,
  VAR_AGGREGATED_METRICS,
  VAR_LABELS_REPLICA,
  VAR_LABELS_REPLICA_EXPR,
  VAR_PRIMARY_LABEL,
  VAR_PRIMARY_LABEL_EXPR,
  VAR_PRIMARY_LABEL_SEARCH,
} from 'services/variables';

const aggregatedMetricsEnabled: boolean | undefined = config.featureToggles.exploreLogsAggregatedMetrics;
// Don't export AGGREGATED_SERVICE_NAME, we want to rename things so the rest of the application is agnostic to how we got the services
const AGGREGATED_SERVICE_NAME = '__aggregated_metric__';

//@todo make start date user configurable, currently hardcoded for experimental cloud release
export const AGGREGATED_METRIC_START_DATE = dateTime('2024-08-30', 'YYYY-MM-DD');

interface ServiceSelectionSceneState extends SceneObjectState {
  // Logs volume API response as dataframe with SceneQueryRunner
  $data: SceneQueryRunner;
  // The body of the component
  body: SceneCSSGridLayout;
  // Pagination options
  countPerPage: number;
  currentPage: number;
  paginationScene?: ServiceSelectionPaginationScene;
  // Show logs of a certain level for a given service
  serviceLevel: Map<string, string[]>;
  showPopover: boolean;

  tabOptions: Array<{
    label: string;
    value: string;
  }>;
  tabs?: ServiceSelectionTabsScene;
}

function renderPrimaryLabelFilters(filters: AdHocVariableFilter[]): string {
  if (filters.length) {
    const filter = filters[0];
    return `${filter.key}${filter.operator}\`${filter.value}\``;
  }

  return '';
}

const primaryLabelUrlKey = 'var-primary_label';
const datasourceUrlKey = 'var-ds';

export class ServiceSelectionScene extends SceneObjectBase<ServiceSelectionSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: [primaryLabelUrlKey],
  });

  constructor(state: Partial<ServiceSelectionSceneState>) {
    super({
      $data: getSceneQueryRunner({
        queries: [],
        runQueriesMode: 'manual',
      }),
      $variables: new SceneVariableSet({
        variables: [
          // Service search variable
          new CustomConstantVariable({
            hide: VariableHide.hideVariable,
            label: 'Service',
            name: VAR_PRIMARY_LABEL_SEARCH,
            skipUrlSync: true,
            value: '.+',
          }),
          // variable that stores if aggregated metrics are supported for the query
          new CustomConstantVariable({
            hide: VariableHide.hideLabel,
            label: '',
            name: VAR_AGGREGATED_METRICS,
            options: [
              {
                label: SERVICE_NAME,
                value: SERVICE_NAME,
              },
              {
                label: AGGREGATED_SERVICE_NAME,
                value: AGGREGATED_SERVICE_NAME,
              },
            ],
            skipUrlSync: true,
            value: SERVICE_NAME,
          }),
          // The active tab expression, hidden variable
          new AdHocFiltersVariable({
            expressionBuilder: (filters) => {
              return renderPrimaryLabelFilters(filters);
            },
            filters: [
              {
                key: getSelectedTabFromUrl().key ?? SERVICE_NAME,
                operator: '=~',
                value: '.+',
              },
            ],
            hide: VariableHide.hideLabel,
            name: VAR_PRIMARY_LABEL,
          }),
          new AdHocFiltersVariable({
            datasource: EXPLORATION_DS,
            expressionBuilder: renderLogQLLabelFilters,
            filters: [],
            hide: VariableHide.hideVariable,
            key: 'adhoc_service_filter_replica',
            layout: 'vertical',
            name: VAR_LABELS_REPLICA,
            skipUrlSync: true,
          }),
        ],
      }),
      body: new SceneCSSGridLayout({ children: [] }),
      // pagination
      countPerPage: getServiceSelectionPageCount() ?? 20,
      currentPage: 1,
      serviceLevel: new Map<string, string[]>(),

      showPopover: false,
      tabOptions: [
        {
          label: SERVICE_UI_LABEL,
          value: SERVICE_NAME,
        },
      ],
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  public static Component = ({ model }: SceneComponentProps<ServiceSelectionScene>) => {
    const styles = useStyles2(getStyles);
    const { $data, body, paginationScene, tabs } = model.useState();
    const { data } = $data.useState();
    const selectedTab = model.getSelectedTab();

    const serviceStringVariable = getServiceSelectionSearchVariable(model);
    const { label, value: searchValue } = serviceStringVariable.useState();
    const hasSearch = searchValue && searchValue !== '.+';

    const { labelsByVolume, labelsToQuery } = model.getLabels(data?.series);
    const isLogVolumeLoading =
      data?.state === LoadingState.Loading || data?.state === LoadingState.Streaming || data === undefined;
    const volumeApiError = $data.state.data?.state === LoadingState.Error;

    const onSearchChange = (serviceName?: string) => {
      model.onSearchServicesChange(serviceName);
    };

    const filterLabel = model.formatPrimaryLabelForUI();
    let customValue = serviceStringVariable.getValue().toString();
    if (customValue === '.+') {
      customValue = '';
    }
    const customLabel = unwrapWildcardSearch(customValue);

    return (
      <div className={styles.container}>
        <div className={styles.bodyWrapper}>
          {tabs && <tabs.Component model={tabs} />}
          <Field className={styles.searchField}>
            <div className={styles.searchWrapper}>
              <ServiceFieldSelector
                initialFilter={{
                  icon: 'filter',
                  label: customLabel,
                  value: customValue,
                }}
                isLoading={isLogVolumeLoading}
                value={customValue ? customValue : label}
                onChange={(serviceName) => onSearchChange(serviceName)}
                selectOption={(value: string) => {
                  goToLabelDrillDownLink(selectedTab, value, model);
                }}
                label={filterLabel}
                options={
                  labelsToQuery?.map((serviceName) => ({
                    label: serviceName,
                    value: serviceName,
                  })) ?? []
                }
              />
              {!isLogVolumeLoading && (
                <span className={styles.searchPaginationWrap}>
                  {paginationScene && (
                    <ServiceSelectionPaginationScene.PageCount
                      model={paginationScene}
                      totalCount={labelsToQuery.length}
                    />
                  )}
                  {paginationScene && (
                    <ServiceSelectionPaginationScene.Component
                      model={paginationScene}
                      totalCount={labelsToQuery.length}
                    />
                  )}
                </span>
              )}
            </div>
          </Field>
          {/** If we don't have any servicesByVolume, volume endpoint is probably not enabled */}
          {!isLogVolumeLoading && volumeApiError && <ConfigureVolumeError />}
          {!isLogVolumeLoading && !volumeApiError && hasSearch && !labelsByVolume?.length && <NoServiceSearchResults />}
          {!isLogVolumeLoading && !volumeApiError && !hasSearch && !labelsByVolume?.length && (
            <NoServiceVolume labelName={selectedTab} />
          )}
          {!(!isLogVolumeLoading && volumeApiError) && (
            <div className={styles.body}>
              <body.Component model={body} />
              <div className={styles.headingWrapper}>
                {paginationScene && (
                  <ServiceSelectionPaginationScene.Component
                    totalCount={labelsToQuery.length}
                    model={paginationScene}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // We could also run model.setState in component, but it is recommended to implement the state-modifying methods in the scene object
  onSearchServicesChange = debounce((primaryLabelSearch?: string) => {
    // Set search variable
    const searchVar = getServiceSelectionSearchVariable(this);

    const newSearchString = primaryLabelSearch ? wrapWildcardSearch(primaryLabelSearch) : '.+';
    if (newSearchString !== searchVar.state.value) {
      searchVar.setState({
        label: primaryLabelSearch ?? '',
        value: primaryLabelSearch ? wrapWildcardSearch(primaryLabelSearch) : '.+',
      });
    }

    const primaryLabelVar = getServiceSelectionPrimaryLabel(this);
    const filter = primaryLabelVar.state.filters[0];

    // Update primary label with search string
    if (wrapWildcardSearch(searchVar.state.value.toString()) !== filter.value) {
      primaryLabelVar.setState({
        filters: [
          {
            ...filter,
            value: wrapWildcardSearch(searchVar.state.value.toString()),
          },
        ],
      });
    }

    this.setState({
      currentPage: 1,
    });

    reportAppInteraction(
      USER_EVENTS_PAGES.service_selection,
      USER_EVENTS_ACTIONS.service_selection.search_services_changed,
      {
        searchQuery: primaryLabelSearch,
      }
    );
  }, 500);

  /**
   * Set changes from the URL to the state of the primary label variable
   */
  getUrlState() {
    const { key } = getSelectedTabFromUrl();
    const primaryLabelVar = getServiceSelectionPrimaryLabel(this);
    const filter = primaryLabelVar.state.filters[0];

    if (filter.key && filter.key !== key) {
      getServiceSelectionPrimaryLabel(this).setState({
        filters: [
          {
            ...filter,
            key: key ?? filter.key,
          },
        ],
      });
    }

    return {};
  }

  /**
   * Unused, but required
   * @param values
   */
  updateFromUrl(values: SceneObjectUrlValues) {}

  addDatasourceChangeToBrowserHistory(newDs: string) {
    const location = locationService.getLocation();
    const search = new URLSearchParams(location.search);
    const dsUrl = search.get(datasourceUrlKey);
    if (dsUrl && newDs !== dsUrl) {
      const currentUrl = location.pathname + location.search;
      search.set(datasourceUrlKey, newDs);
      const newUrl = location.pathname + '?' + search.toString();
      if (currentUrl !== newUrl) {
        pushUrlHandler(newUrl);
      }
    }
  }

  /**
   * Attempting to add any change to the primary label variable (i.e. the selected tab) as a browser history event
   * @param newKey
   * @param replace
   */
  addLabelChangeToBrowserHistory(newKey: string, replace = false) {
    const { key: primaryLabelRaw, location, search } = getSelectedTabFromUrl();
    if (primaryLabelRaw) {
      const primaryLabelSplit = primaryLabelRaw?.split('|');
      const keyInUrl = primaryLabelSplit?.[0];

      if (keyInUrl !== newKey) {
        primaryLabelSplit[0] = newKey;
        search.set(primaryLabelUrlKey, primaryLabelSplit.join('|'));
        const currentUrl = location.pathname + location.search;
        const newUrl = location.pathname + '?' + search.toString();
        if (currentUrl !== newUrl) {
          if (replace) {
            locationService.replace(newUrl);
          } else {
            pushUrlHandler(newUrl);
          }
        }
      }
    }
  }

  getSelectedTab() {
    return getServiceSelectionPrimaryLabel(this).state.filters[0]?.key;
  }

  selectDefaultLabelTab() {
    // Need to update the history before the state with replace instead of push, or we'll get invalid services saved to url state after changing datasource
    this.addLabelChangeToBrowserHistory(SERVICE_NAME, true);
    this.setSelectedTab(SERVICE_NAME);
  }

  setSelectedTab(labelName: string) {
    addTabToLocalStorage(getDataSourceVariable(this).getValue().toString(), labelName);

    // clear active search
    clearServiceSelectionSearchVariable(this);

    // Update the primary label variable
    setServiceSelectionPrimaryLabelKey(labelName, this);
  }

  // Creates a layout with timeseries panel
  buildServiceLayout(
    primaryLabelName: string,
    primaryLabelValue: string,
    serviceLabelVar: CustomConstantVariable,
    primaryLabelVar: AdHocFiltersVariable,
    datasourceVar: DataSourceVariable
  ) {
    const headerActions = [];

    if (this.isAggregatedMetricsActive()) {
      headerActions.push(new SelectServiceButton({ labelName: primaryLabelName, labelValue: primaryLabelValue }));
    } else {
      headerActions.push(
        new AddLabelToFiltersHeaderActionScene({
          name: primaryLabelName,
          value: primaryLabelValue,
        })
      );
      headerActions.push(new SelectServiceButton({ labelName: primaryLabelName, labelValue: primaryLabelValue }));
    }
    const panel = PanelBuilders.timeseries()
      // If service was previously selected, we show it in the title
      .setTitle(primaryLabelValue)
      .setData(
        getQueryRunner(
          [
            buildDataQuery(this.getMetricExpression(primaryLabelValue, serviceLabelVar, primaryLabelVar), {
              legendFormat: `{{${LEVEL_VARIABLE_VALUE}}}`,
              refId: `ts-${primaryLabelValue}`,
              step: serviceLabelVar.state.value === AGGREGATED_SERVICE_NAME ? '10s' : undefined,
            }),
          ],
          { runQueriesMode: 'manual' }
        )
      )
      .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
      .setCustomFieldConfig('fillOpacity', 100)
      .setCustomFieldConfig('lineWidth', 0)
      .setCustomFieldConfig('pointSize', 0)
      .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
      .setUnit('short')
      .setOverrides(setLevelColorOverrides)
      .setOption('legend', {
        calcs: ['sum'],
        displayMode: LegendDisplayMode.Table,
        placement: 'right',
        showLegend: true,
      })
      .setHeaderActions([
        new FavoriteServiceHeaderActionScene({
          ds: datasourceVar.getValue()?.toString() ?? '',
          labelName: primaryLabelName,
          labelValue: primaryLabelValue,
        }),
        ...headerActions,
      ])
      .build();

    panel.setState({
      extendPanelContext: (_, context) =>
        this.extendTimeSeriesLegendBus(primaryLabelName, primaryLabelValue, context, panel),
    });

    const cssGridItem = new SceneCSSGridItem({
      $behaviors: [new behaviors.CursorSync({ key: 'serviceCrosshairSync', sync: DashboardCursorSync.Crosshair })],
      body: panel,
    });

    cssGridItem.addActivationHandler(() => {
      const runner = getQueryRunnerFromChildren(cssGridItem)[0];
      // If the query runner has already ran, the scene must be cached, don't re-run as the volume query will be triggered which will execute another panel query
      if (runner.state.data?.state !== LoadingState.Done) {
        this.runPanelQuery(cssGridItem);
      }
    });

    return cssGridItem;
  }

  isAggregatedMetricsActive() {
    const toolbar = this.getQueryOptionsToolbar();
    return !toolbar?.state.options.aggregatedMetrics.disabled && toolbar?.state.options.aggregatedMetrics.active;
  }

  getLevelFilterForService = (service: string) => {
    let serviceLevels = this.state.serviceLevel.get(service) || [];
    if (serviceLevels.length === 0) {
      return '';
    }
    const filters = serviceLevels.map((level) => {
      if (level === 'logs') {
        level = '';
      }
      return `${LEVEL_VARIABLE_VALUE}=\`${level}\``;
    });
    return ` | ${filters.join(' or ')} `;
  };

  // Creates a layout with logs panel
  buildServiceLogsLayout = (labelName: string, labelValue: string) => {
    const levelFilter = this.getLevelFilterForService(labelValue);
    const cssGridItem = new SceneCSSGridItem({
      $behaviors: [new behaviors.CursorSync({ sync: DashboardCursorSync.Off })],
      body: PanelBuilders.logs()
        // Hover header set to true removes unused header padding, displaying more logs
        .setHoverHeader(true)
        .setData(
          getQueryRunner(
            [
              buildDataQuery(this.getLogExpression(labelName, labelValue, levelFilter), {
                maxLines: 100,
                refId: `logs-${labelValue}`,
              }),
            ],
            {
              runQueriesMode: 'manual',
            }
          )
        )
        .setTitle(labelValue)
        .setOption('showTime', true)
        .setOption('enableLogDetails', false)
        .setOption('fontSize', 'small')
        .setOption('displayedFields', getDisplayedFieldsForLabelValue(this, labelName, labelValue))
        // @ts-expect-error Requires Grafana 12.2
        .setOption('noInteractions', true)
        .build(),
    });

    cssGridItem.addActivationHandler(() => {
      const runner = getQueryRunnerFromChildren(cssGridItem)[0];
      // If the query runner has already ran, the scene must be cached, don't re-run as the volume query will be triggered which will execute another panel query
      if (runner.state.data?.state !== LoadingState.Done) {
        this.runPanelQuery(cssGridItem);
      }
    });

    return cssGridItem;
  };

  formatPrimaryLabelForUI() {
    const selectedTab = this.getSelectedTab();
    return selectedTab === SERVICE_NAME ? SERVICE_UI_LABEL : selectedTab;
  }

  private setVolumeQueryRunner() {
    this.setState({
      $data: getSceneQueryRunner({
        queries: [
          buildVolumeQuery(`{${VAR_PRIMARY_LABEL_EXPR}, ${VAR_LABELS_REPLICA_EXPR}}`, 'volume', this.getSelectedTab()),
        ],
        runQueriesMode: 'manual',
      }),
    });

    // Need to re-init any subscriptions since we changed the query runner
    this.subscribeToVolume();
  }

  private doVariablesNeedSync() {
    const labelsVarPrimary = getLabelsVariable(this);
    const labelsVarReplica = getLabelsVariableReplica(this);

    const activeTab = this.getSelectedTab();
    const filteredFilters = labelsVarPrimary.state.filters.filter((f) => f.key !== activeTab);

    return { filters: filteredFilters, needsSync: !areArraysEqual(filteredFilters, labelsVarReplica.state.filters) };
  }

  private syncVariables() {
    const labelsVarReplica = getLabelsVariableReplica(this);

    const { filters, needsSync } = this.doVariablesNeedSync();
    if (needsSync) {
      labelsVarReplica.setState({ filters });
    }
  }

  private onActivate() {
    this.fixRequiredUrlParams();

    // Sync initial state from primary labels to local replica
    this.syncVariables();

    // Clear existing volume data on activate or we'll show stale cached data, potentially from a different datasource
    this.setVolumeQueryRunner();

    // Subscribe to primary labels for further updates
    this.subscribeToPrimaryLabelsVariable();

    // Subscribe to variables replica
    this.subscribeToLabelFilterChanges();

    // Subscribe to tab changes (primary label)
    this.subscribeToActiveTabVariable(getServiceSelectionPrimaryLabel(this));

    if (this.state.$data.state.data?.state !== LoadingState.Done) {
      this.runVolumeOnActivate();
    }

    // Update labels on time range change
    this.subscribeToTimeRange();

    // Update labels on datasource change
    this.subscribeToDatasource();

    this.subscribeToAggregatedMetricToggle();

    this.subscribeToAggregatedMetricVariable();
  }

  private runVolumeOnActivate() {
    if (this.isTimeRangeTooEarlyForAggMetrics()) {
      this.onUnsupportedAggregatedMetricTimeRange();
      if (this.state.$data.state.data?.state !== LoadingState.Done) {
        this.runVolumeQuery();
      }
    } else {
      this.onSupportedAggregatedMetricTimeRange();
      if (this.state.$data.state.data?.state !== LoadingState.Done) {
        this.runVolumeQuery();
      }
    }
  }

  private subscribeToAggregatedMetricToggle() {
    this._subs.add(
      this.getQueryOptionsToolbar()?.subscribeToState((newState, prevState) => {
        if (newState.options.aggregatedMetrics.userOverride !== prevState.options.aggregatedMetrics.userOverride) {
          this.runVolumeQuery(true);
        }
      })
    );
  }

  private subscribeToDatasource() {
    this._subs.add(
      getDataSourceVariable(this).subscribeToState((newState) => {
        this.setState({
          body: new SceneCSSGridLayout({ children: [] }),
        });
        this.addDatasourceChangeToBrowserHistory(newState.value.toString());
        this.runVolumeQuery();
      })
    );
  }

  private subscribeToActiveTabVariable(primaryLabelVar: AdHocFiltersVariable) {
    this._subs.add(
      primaryLabelVar.subscribeToState((newState, prevState) => {
        if (newState.filterExpression !== prevState.filterExpression) {
          const newKey = newState.filters[0].key;
          this.addLabelChangeToBrowserHistory(newKey);
          // Need to tear down volume query runner to select other labels, as we need the selected tab to parse the volume response
          const { needsSync } = this.doVariablesNeedSync();

          if (needsSync) {
            this.syncVariables();
          } else {
            this.runVolumeQuery(true);
          }
        }
      })
    );
  }

  /**
   * agg metrics need parser and unwrap, have to tear down and rebuild panels when the variable changes
   * @private
   */
  private subscribeToAggregatedMetricVariable() {
    this._subs.add(
      getAggregatedMetricsVariable(this).subscribeToState((newState, prevState) => {
        if (newState.value !== prevState.value) {
          // Clear the body panels
          this.setState({
            body: new SceneCSSGridLayout({ children: [] }),
          });
          // And re-init with the new query
          this.updateBody(true);
        }
      })
    );
  }

  private subscribeToPrimaryLabelsVariable() {
    const labelsVarPrimary = getLabelsVariable(this);
    this._subs.add(
      labelsVarPrimary.subscribeToState((newState, prevState) => {
        if (!areArraysEqual(newState.filters, prevState.filters)) {
          this.syncVariables();
        }
      })
    );
  }

  private subscribeToLabelFilterChanges() {
    const labelsVar = getLabelsVariableReplica(this);
    this._subs.add(
      labelsVar.subscribeToState((newState, prevState) => {
        if (!areArraysEqual(newState.filters, prevState.filters)) {
          this.runVolumeQuery(true);
        }
      })
    );
  }

  private subscribeToVolume() {
    this._subs.add(
      this.state.$data.subscribeToState((newState, prevState) => {
        // update body if the data is done loading, and the dataframes have changed
        if (
          newState.data?.state === LoadingState.Done &&
          !areArraysEqual(prevState?.data?.series, newState?.data?.series)
        ) {
          this.updateBody(true);
        }
      })
    );
  }

  private subscribeToTimeRange() {
    this._subs.add(
      sceneGraph.getTimeRange(this).subscribeToState(() => {
        if (this.isTimeRangeTooEarlyForAggMetrics()) {
          this.onUnsupportedAggregatedMetricTimeRange();
        } else {
          this.onSupportedAggregatedMetricTimeRange();
        }
        this.runVolumeQuery();
      })
    );
  }

  /**
   * If the user copies a partial URL we want to prevent throwing runtime errors or running invalid queries, so we set the default tab which will trigger updates to the primary_label
   * @private
   */
  private fixRequiredUrlParams() {
    // If the selected tab is not in the URL, set the default
    const { key } = getSelectedTabFromUrl();
    if (!key) {
      this.selectDefaultLabelTab();
    }
  }

  private isTimeRangeTooEarlyForAggMetrics(): boolean {
    const timeRange = sceneGraph.getTimeRange(this);
    return timeRange.state.value.from.isBefore(dateTime(AGGREGATED_METRIC_START_DATE));
  }

  private onUnsupportedAggregatedMetricTimeRange() {
    const toolbar = this.getQueryOptionsToolbar();
    toolbar?.setState({
      options: {
        aggregatedMetrics: {
          ...toolbar?.state.options.aggregatedMetrics,
          disabled: true,
        },
      },
    });
  }

  private getQueryOptionsToolbar() {
    const indexScene = sceneGraph.getAncestor(this, IndexScene);
    return indexScene.state.controls?.find((control) => control instanceof ToolbarScene) as ToolbarScene | undefined;
  }

  private onSupportedAggregatedMetricTimeRange() {
    const toolbar = this.getQueryOptionsToolbar();
    toolbar?.setState({
      options: {
        aggregatedMetrics: {
          ...toolbar?.state.options.aggregatedMetrics,
          disabled: false,
        },
      },
    });
  }

  /**
   * Executes the Volume API call
   * @param resetQueryRunner - optional param which will replace the query runner state with a new instantiation
   * @private
   */
  private runVolumeQuery(resetQueryRunner = false) {
    if (resetQueryRunner) {
      this.setVolumeQueryRunner();
    }

    this.updateAggregatedMetricVariable();
    this.state.$data.runQueries();
  }

  private updateAggregatedMetricVariable() {
    const serviceLabelVar = getAggregatedMetricsVariable(this);
    const labelsVar = getLabelsVariable(this);
    if ((!this.isTimeRangeTooEarlyForAggMetrics() || !aggregatedMetricsEnabled) && this.isAggregatedMetricsActive()) {
      serviceLabelVar.changeValueTo(AGGREGATED_SERVICE_NAME);

      // Hide combobox and reset filters if aggregated metrics is enabled
      labelsVar.setState({
        filters: [],
        hide: VariableHide.hideVariable,
      });

      // Hide the show logs button
      const showLogsButton = sceneGraph.findByKeyAndType(this, showLogsButtonSceneKey, ShowLogsButtonScene);
      showLogsButton.setState({ hidden: true });
    } else {
      serviceLabelVar.changeValueTo(SERVICE_NAME);
      // Show combobox if not aggregated metrics
      labelsVar.setState({
        hide: VariableHide.dontHide,
      });
      serviceLabelVar.changeValueTo(SERVICE_NAME);

      // Show the show logs button
      const showLogsButton = sceneGraph.findByKeyAndType(this, showLogsButtonSceneKey, ShowLogsButtonScene);
      showLogsButton.setState({ hidden: false });
    }
  }

  private updateTabs() {
    if (!this.state.tabs) {
      const tabs = new ServiceSelectionTabsScene({});
      this.setState({
        tabs,
      });
    }
  }

  private getGridItems(): SceneCSSGridItem[] {
    return this.state.body.state.children as SceneCSSGridItem[];
  }

  private getVizPanel(child: SceneCSSGridItem) {
    return child.state.body instanceof VizPanel ? child.state.body : undefined;
  }

  /**
   * Runs logs/volume panel queries if lazy loaded grid item is active
   * @param child
   * @private
   */
  private runPanelQuery(child: SceneCSSGridItem) {
    if (child.isActive) {
      const queryRunners = getQueryRunnerFromChildren(child);
      if (queryRunners.length === 1) {
        const queryRunner = queryRunners[0];
        const query = queryRunner.state.queries[0];

        // If the scene was cached, the time range will still be the same as what was executed in the query
        const requestTimeRange = queryRunner.state.data?.timeRange;
        const sceneTimeRange = sceneGraph.getTimeRange(this);
        const fromDiff = requestTimeRange
          ? Math.abs(sceneTimeRange.state.value.from.diff(requestTimeRange?.from, 's'))
          : Infinity;
        const toDiff = requestTimeRange
          ? Math.abs(sceneTimeRange.state.value.to.diff(requestTimeRange?.to, 's'))
          : Infinity;

        const interpolated = sceneGraph.interpolate(this, query.expr);
        // If we haven't already run this exact same query, run it
        if (queryRunner.state.key !== interpolated || fromDiff > 0 || toDiff > 0) {
          queryRunner.setState({
            key: interpolated,
          });
          queryRunner.runQueries();
        }
      }
    }
  }

  public updateBody(runQueries = false) {
    const { labelsToQuery } = this.getLabels(this.state.$data.state.data?.series);
    const selectedTab = this.getSelectedTab();
    this.updateTabs();

    if (!this.state.paginationScene) {
      this.setState({
        paginationScene: new ServiceSelectionPaginationScene({}),
      });
    }

    // If no services are to be queried, clear the body
    if (!labelsToQuery || labelsToQuery.length === 0) {
      this.state.body.setState({ children: [] });
    } else {
      // If we have services to query, build the layout with the services. Children is an array of layouts for each service (1 row with 2 columns - timeseries and logs panel)
      const newChildren: SceneCSSGridItem[] = [];
      const existingChildren = this.getGridItems();
      const aggregatedMetricsVariable = getAggregatedMetricsVariable(this);
      const primaryLabelVar = getServiceSelectionPrimaryLabel(this);
      const datasourceVariable = getDataSourceVariable(this);

      const start = (this.state.currentPage - 1) * this.state.countPerPage;
      const end = start + this.state.countPerPage;

      for (const primaryLabelValue of labelsToQuery.slice(start, end)) {
        const existing = existingChildren.filter((child) => {
          const vizPanel = this.getVizPanel(child);
          return vizPanel?.state.title === primaryLabelValue;
        });

        if (existing.length === 2) {
          // If we already have grid items for this service, move them over to the new array of children, this will preserve their queryRunners, preventing duplicate queries from getting run
          newChildren.push(existing[0], existing[1]);

          if (existing[0].isActive && runQueries) {
            this.runPanelQuery(existing[0]);
          }

          if (existing[1].isActive && runQueries) {
            this.runPanelQuery(existing[1]);
          }
        } else {
          const newChildTs = this.buildServiceLayout(
            selectedTab,
            primaryLabelValue,
            aggregatedMetricsVariable,
            primaryLabelVar,
            datasourceVariable
          );
          const newChildLogs = this.buildServiceLogsLayout(selectedTab, primaryLabelValue);
          // for each service, we create a layout with timeseries and logs panel
          newChildren.push(newChildTs, newChildLogs);
        }
      }

      this.state.body.setState({
        autoRows: '200px',
        children: newChildren,
        isLazy: true,
        md: {
          columnGap: 1,
          rowGap: 1,
          templateColumns: '1fr',
        },
        templateColumns: 'repeat(auto-fit, minmax(350px, 1fr) minmax(300px, calc(70vw - 100px)))',
      });
    }
  }

  /**
   * Redraws service logs after toggling level visibility.
   */
  private updateServiceLogs(labelName: string, labelValue: string) {
    if (!this.state.body) {
      this.updateBody();
      return;
    }
    const { labelsToQuery } = this.getLabels(this.state.$data.state.data?.series);
    const serviceIndex = labelsToQuery?.indexOf(labelValue);
    if (serviceIndex === undefined || serviceIndex < 0) {
      return;
    }
    let newChildren = [...this.getGridItems()];
    newChildren.splice(serviceIndex * 2 + 1, 1, this.buildServiceLogsLayout(labelName, labelValue));
    this.state.body.setState({ children: newChildren });
  }

  private getLogExpression(labelName: string, labelValue: string, levelFilter: string) {
    return `{${labelName}=\`${labelValue}\` , ${VAR_LABELS_REPLICA_EXPR} }${levelFilter}`;
  }

  private getMetricExpression(
    labelValue: string,
    serviceLabelVar: CustomConstantVariable,
    primaryLabelVar: AdHocFiltersVariable
  ) {
    const filter = primaryLabelVar.state.filters[0];
    if (serviceLabelVar.state.value === AGGREGATED_SERVICE_NAME) {
      if (filter.key === SERVICE_NAME) {
        return `sum by (${LEVEL_VARIABLE_VALUE}) (sum_over_time({${AGGREGATED_SERVICE_NAME}=\`${labelValue}\` } | logfmt | unwrap count [$__auto]))`;
      } else {
        return `sum by (${LEVEL_VARIABLE_VALUE}) (sum_over_time({${AGGREGATED_SERVICE_NAME}=~\`.+\` } | logfmt | ${filter.key}=\`${labelValue}\` | unwrap count [$__auto]))`;
      }
    }
    return `sum by (${LEVEL_VARIABLE_VALUE}) (count_over_time({ ${filter.key}=\`${labelValue}\`, ${VAR_LABELS_REPLICA_EXPR} } [$__auto]))`;
  }

  private extendTimeSeriesLegendBus = (
    labelName: string,
    labelValue: string,
    context: PanelContext,
    panel: VizPanel
  ) => {
    const originalOnToggleSeriesVisibility = context.onToggleSeriesVisibility;

    context.onToggleSeriesVisibility = (level: string, mode: SeriesVisibilityChangeMode) => {
      originalOnToggleSeriesVisibility?.(level, mode);

      const allLevels = getLevelLabelsFromSeries(panel.state.$data?.state.data?.series ?? []);
      const levels = toggleLevelVisibility(level, this.state.serviceLevel.get(labelValue), mode, allLevels);
      this.state.serviceLevel.set(labelValue, levels);

      this.updateServiceLogs(labelName, labelValue);
    };
  };

  private getLabels(series?: DataFrame[]) {
    const labelsByVolume: string[] = series?.[0]?.fields[0].values ?? [];
    const dsString = getDataSourceVariable(this).getValue()?.toString();
    const searchString = getServiceSelectionSearchVariable(this).getValue();
    const selectedTab = this.getSelectedTab();
    const labelsToQuery = createListOfLabelsToQuery(labelsByVolume, dsString, String(searchString), selectedTab);
    return { labelsByVolume, labelsToQuery: labelsToQuery };
  }
}

// Create a list of services to query:
// 1. Filters provided services by searchString
// 2. Gets favoriteServicesToQuery from localStorage and filters them by searchString
// 3. Orders them correctly
function createListOfLabelsToQuery(services: string[], ds: string, searchString: string, labelName: string) {
  if (!services?.length) {
    return [];
  }

  if (searchString === '.+') {
    searchString = '';
  }

  const favoriteServicesToQuery = getFavoriteLabelValuesFromStorage(ds, labelName).filter(
    (service) => service.toLowerCase().includes(searchString.toLowerCase()) && services.includes(service)
  );

  // Deduplicate
  return Array.from(new Set([...favoriteServicesToQuery, ...services]));
}

function getSelectedTabFromUrl() {
  const location = locationService.getLocation();
  const search = new URLSearchParams(location.search);
  const primaryLabelRaw = search.get(primaryLabelUrlKey);
  const primaryLabelSplit = primaryLabelRaw?.split('|');
  const key = primaryLabelSplit?.[0];
  return { key, location, search };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    body: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
    }),
    bodyWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
    }),
    container: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      position: 'relative',
    }),
    header: css({
      position: 'absolute',
      right: 0,
      top: '4px',
      zIndex: 2,
    }),
    headingWrapper: css({
      marginTop: theme.spacing(1),
    }),
    loadingText: css({
      margin: 0,
    }),
    searchField: css({
      marginTop: theme.spacing(1),
      position: 'relative',
    }),
    searchPaginationWrap: css({
      [theme.breakpoints.down('md')]: {
        marginTop: theme.spacing(1),
        width: '100%',
      },
      alignItems: 'center',
      display: 'flex',
      flex: '1 0 auto',
      flexWrap: 'wrap',
      label: 'search-pagination-wrap',
    }),
    searchWrapper: css({
      [theme.breakpoints.down('md')]: {
        alignItems: 'flex-start',
        flexDirection: 'column',
      },
      alignItems: 'center',
      display: 'flex',
      flexWrap: 'wrap',
      label: 'search-wrapper',
    }),
  };
}
