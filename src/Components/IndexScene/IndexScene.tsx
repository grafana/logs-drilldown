import React from 'react';

import { getAPIBaseURL } from '@grafana/api-clients';
import {
  LogsDrilldownDefaultColumns,
  LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords,
} from '@grafana/api-clients/rtkq/logsdrilldown/v1beta1';
import { isAssistantAvailable, providePageContext } from '@grafana/assistant';
import { AdHocVariableFilter, AppEvents, AppPluginMeta, LoadingState, rangeUtil, urlUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getAppEvents, locationService } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  AdHocFilterWithLabels,
  CustomVariable,
  DataSourceVariable,
  SceneComponentProps,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  SceneTimeRangeLike,
  SceneTimeRangeState,
  SceneVariableSet,
} from '@grafana/scenes';
import { VariableHide } from '@grafana/schema';
import { LoadingPlaceholder } from '@grafana/ui';

import { plugin } from '../../module';
import { CustomVariableValueSelectors } from './CustomVariableValueSelectors';
import {
  CONTROLS_JSON_FIELDS,
  CONTROLS_VARS_DATASOURCE,
  CONTROLS_VARS_FIELDS,
  CONTROLS_VARS_FIELDS_COMBINED,
  CONTROLS_VARS_FIRST_ROW_KEY,
  CONTROLS_VARS_LABELS,
  CONTROLS_VARS_METADATA_ROW_KEY,
  CONTROLS_VARS_REFRESH,
  CONTROLS_VARS_TIMEPICKER,
  CONTROLS_VARS_TOOLBAR,
  LayoutScene,
} from './LayoutScene';
import { ShowLogsButtonScene } from './ShowLogsButtonScene';
import { ToolbarScene } from './ToolbarScene';
import { IndexSceneState } from './types';
import { JsonData } from 'Components/AppConfig/AppConfig';
import { isDefaultColumnsSupported } from 'Components/AppConfig/DefaultColumns/isSupported';
import { isDefaultLabelsSupported } from 'Components/AppConfig/ServiceSelection/isSupported';
import { NoLokiSplash } from 'Components/NoLokiSplash';
import { DEFAULT_TIME_RANGE } from 'Components/Pages';
import { ServiceScene } from 'Components/ServiceScene/ServiceScene';
import { ServiceSelectionScene } from 'Components/ServiceSelectionScene/ServiceSelectionScene';
import { getFeatureFlag } from 'featureFlags/openFeature';
import { reportAppInteraction } from 'services/analytics';
import { getDefaultLabelSettings } from 'services/api';
import {
  provideServiceBreakdownQuestions,
  provideServiceSelectionQuestions,
  updateAssistantContext,
} from 'services/assistant';
import { areArraysEqual } from 'services/comparison';
import { CustomConstantVariable } from 'services/CustomConstantVariable';
import { LOKI_CONFIG_API_NOT_SUPPORTED } from 'services/datasourceTypes';
import { PageSlugs } from 'services/enums';
import { getFieldsTagValuesExpression } from 'services/expressions';
import { isFilterMetadata } from 'services/filters';
import { FilterOp, LineFilterType } from 'services/filterTypes';
import { getCopiedTimeRange, PasteTimeEvent, setupKeyboardShortcuts } from 'services/keyboardShortcuts';
import { logger } from 'services/logger';
import { getLevelsFromLogsVolume } from 'services/logsVolume';
import { getMetadataService } from 'services/metadata';
import { narrowDrilldownLabelFromSearchParams, narrowPageSlugFromSearchParams } from 'services/narrowing';
import { isOperatorInclusive } from 'services/operatorHelpers';
import { lineFilterOperators, operators } from 'services/operators';
import { getConfigQueryRunner } from 'services/panel';
import {
  getJsonParserSegment,
  getLogfmtParserSegment,
  getParserEnabled,
  setParserEnabled,
} from 'services/parserToggle';
import { PLUGIN_BASE_URL } from 'services/plugin';
import {
  getJsonParserExpressionBuilder,
  getLineFormatExpressionBuilder,
  interpolateExpression,
  onAddCustomAdHocValue,
  onAddCustomFieldValue,
  renderLevelsFilter,
  renderLogQLFieldFilters,
  renderLogQLLabelFilters,
  renderLogQLLineFilter,
  renderLogQLMetadataFilters,
} from 'services/query';
import { renderPatternFilters } from 'services/renderPatternFilters';
import { getDrilldownSlug, SERVICE_URL_EXCLUDED_KEYS } from 'services/routing';
import { getLokiDatasource } from 'services/scenes';
import {
  addLastUsedDataSourceToStorage,
  getDefaultDatasourceFromDatasourceSrv,
  getLastUsedDataSourceFromStorage,
} from 'services/store';
import { getFieldsKeysProvider, getLabelsTagKeysProvider } from 'services/TagKeysProviders';
import { getDetectedFieldValuesTagValuesProvider, getLabelsTagValuesProvider } from 'services/TagValuesProviders';
import { filterInvalidTimeOptions, getQuickOptions } from 'services/timePicker';
import {
  getDataSourceVariable,
  getFieldsAndMetadataVariable,
  getFieldsVariable,
  getJSONFieldsVariable,
  getLabelsVariable,
  getLevelsVariable,
  getLineFiltersVariable,
  getLineFormatVariable,
  getMetadataVariable,
  getPatternsVariable,
  getUrlParamNameForVariable,
} from 'services/variableGetters';
import { areLabelFiltersEqual, operatorFunction } from 'services/variableHelpers';
import {
  AdHocFiltersWithLabelsAndMeta,
  AppliedPattern,
  EXPLORATION_DS,
  MIXED_FORMAT_EXPR,
  PENDING_FIELDS_EXPR,
  PENDING_METADATA_EXPR,
  VAR_DATASOURCE,
  VAR_FIELDS,
  VAR_FIELDS_AND_METADATA,
  VAR_JSON_FIELDS,
  VAR_JSON_PARSER,
  VAR_LABELS,
  VAR_LEVELS,
  VAR_LINE_FILTER,
  VAR_LINE_FILTERS,
  VAR_LINE_FORMAT,
  VAR_LOGFMT_PARSER,
  VAR_LOGS_FORMAT,
  VAR_METADATA,
  VAR_PATTERNS,
} from 'services/variables';

export const showLogsButtonSceneKey = 'showLogsButtonScene';

const FALLBACK_DATASOURCE_UID = 'grafanacloud-logs';

interface EmbeddedIndexSceneConstructor {
  datasourceUid?: string;
  hideTimePicker?: boolean;
}

export class IndexScene extends SceneObjectBase<IndexSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['patterns'] });
  private assistantInitialized = false;

  public constructor(state: Partial<IndexSceneState & EmbeddedIndexSceneConstructor>) {
    const { jsonData } = plugin.meta as AppPluginMeta<JsonData>;
    const datasourceUid =
      state?.datasourceUid ??
      jsonData?.dataSource ??
      getLastUsedDataSourceFromStorage() ??
      getDefaultDatasourceFromDatasourceSrv() ??
      FALLBACK_DATASOURCE_UID;

    const { unsub, variablesScene } = getVariableSet(
      datasourceUid,
      state?.initialLabels,
      state.embedded,
      state.defaultLineFilters,
      state.initialFields
    );

    const controls: SceneObject[] = [
      new SceneFlexLayout({
        children: [
          new SceneFlexItem({
            body: new CustomVariableValueSelectors({
              include: [VAR_LABELS],
              key: CONTROLS_VARS_LABELS,
              layout: 'vertical',
            }),
          }),
          new ShowLogsButtonScene({
            disabled: true,
            key: showLogsButtonSceneKey,
          }),
        ],
        direction: 'row',
        key: CONTROLS_VARS_FIRST_ROW_KEY,
      }),
      new CustomVariableValueSelectors({
        include: [VAR_METADATA],
        key: CONTROLS_VARS_METADATA_ROW_KEY,
        layout: 'vertical',
      }),
      new CustomVariableValueSelectors({
        include: [VAR_FIELDS],
        key: CONTROLS_VARS_FIELDS,
        layout: 'vertical',
      }),
      new CustomVariableValueSelectors({
        include: [VAR_DATASOURCE],
        key: CONTROLS_VARS_DATASOURCE,
        layout: 'horizontal',
      }),
      new CustomVariableValueSelectors({
        include: [VAR_FIELDS_AND_METADATA],
        key: CONTROLS_VARS_FIELDS_COMBINED,
        layout: 'vertical',
      }),
      new CustomVariableValueSelectors({
        include: [VAR_JSON_FIELDS, VAR_LINE_FORMAT],
        key: CONTROLS_JSON_FIELDS,
        layout: 'vertical',
      }),
      new SceneTimePicker({
        hidePicker: state.hideTimePicker,
        key: CONTROLS_VARS_TIMEPICKER,
        quickRanges: filterInvalidTimeOptions(getQuickOptions()),
      }),
    ];

    if (!state.hideTimePicker) {
      controls.push(
        new SceneRefreshPicker({
          key: CONTROLS_VARS_REFRESH,
        })
      );
    }

    if (
      getDrilldownSlug() === 'explore' &&
      (getFeatureFlag('exploreLogsAggregatedMetrics') || getFeatureFlag('drilldown.logs.kgAnnotationsInLokiExplore'))
    ) {
      controls.push(
        new ToolbarScene({
          key: CONTROLS_VARS_TOOLBAR,
        })
      );
    }

    super({
      $timeRange: state.$timeRange ?? new SceneTimeRange({}),
      $variables: state.$variables ?? variablesScene,
      $lokiConfig: getConfigQueryRunner(),
      controls: state.controls ?? controls,
      embedded: state.embedded ?? false,
      // Need to clear patterns state when the class in constructed
      patterns: [],
      ...state,
      body: new LayoutScene({}),
    });

    this._subs.add(unsub);
    this.addActivationHandler(this.onActivate.bind(this));

    getLokiDatasource(this).then((ds) => {
      this.setState({ ds });
    });
  }

  static Component = ({ model }: SceneComponentProps<IndexScene>) => {
    const { body } = model.useState();

    const dsVar = getDataSourceVariable(model);
    if (!dsVar.state.options.length) {
      return <NoLokiSplash />;
    }

    if (body) {
      return <body.Component model={body} />;
    }

    return <LoadingPlaceholder text={t('components.index-scene.text-loading', 'Loading...')} />;
  };

  public onActivate() {
    const stateUpdate: Partial<IndexSceneState> = {};
    this.setVariableProviders();

    if (!this.state.embedded && this.userInServiceSelection()) {
      const searchParams = urlUtil.getUrlSearchParams();
      const hasExcludedServiceUrlKey = SERVICE_URL_EXCLUDED_KEYS.some((key) => Object.hasOwn(searchParams, key));

      if (hasExcludedServiceUrlKey) {
        // Strip only the stuck drilldown-only keys, keeping the rest of the service-selection URL
        // state intact (filters, primary label, patterns, time range, ...).
        const location = locationService.getLocation();
        const cleanSearchParams = { ...searchParams };
        SERVICE_URL_EXCLUDED_KEYS.forEach((key) => delete cleanSearchParams[key]);

        const cleanUrl = urlUtil.renderUrl(location.pathname, cleanSearchParams);
        const currentUrl = location.pathname + location.search;

        if (cleanUrl !== currentUrl) {
          locationService.replace(cleanUrl);
        }
      }
    }

    // Show "show logs" button
    const showLogsButton = sceneGraph.findByKeyAndType(this, showLogsButtonSceneKey, ShowLogsButtonScene);
    showLogsButton.setState({ hidden: false });

    this.setTagProviders();
    this.setState(stateUpdate);

    this.updatePatterns(this.state, getPatternsVariable(this));

    if (!this.state.embedded) {
      this.resetVariablesIfNotInUrl(getFieldsVariable(this), getUrlParamNameForVariable(VAR_FIELDS));
      this.resetVariablesIfNotInUrl(getLevelsVariable(this), getUrlParamNameForVariable(VAR_LEVELS));
      this.resetVariablesIfNotInUrl(getLineFiltersVariable(this), getUrlParamNameForVariable(VAR_LINE_FILTERS));
      this.resetVariablesIfNotInUrl(getJSONFieldsVariable(this), getUrlParamNameForVariable(VAR_JSON_FIELDS));
      this.resetVariablesIfNotInUrl(getLineFormatVariable(this), getUrlParamNameForVariable(VAR_LINE_FORMAT));
    }

    this._subs.add(
      this.subscribeToState((newState, prevState) => {
        this.updatePatterns(newState, getPatternsVariable(this));

        const lokiConfig = newState.lokiConfig;
        const configChanged =
          lokiConfig && lokiConfig !== LOKI_CONFIG_API_NOT_SUPPORTED && lokiConfig !== prevState.lokiConfig;
        if (configChanged) {
          const timePicker = sceneGraph.findByKeyAndType(this, CONTROLS_VARS_TIMEPICKER, SceneTimePicker);
          timePicker.setState({
            quickRanges: filterInvalidTimeOptions(getQuickOptions(), lokiConfig),
          });
        }
      })
    );

    const timeRange = sceneGraph.getTimeRange(this);

    this._subs.add(timeRange.subscribeToState(this.limitMaxInterval(timeRange)));
    this._subs.add(this.subscribeToEvent(PasteTimeEvent, this.subscribeToPasteTimeEvent));

    const fieldFilters = getFieldsVariable(this).state.filters;
    const metadataFilters = getMetadataVariable(this).state.filters;

    const fieldsAndMetadataVariable = getFieldsAndMetadataVariable(this);

    // Sync fields in query variables to support existing urls
    fieldsAndMetadataVariable.updateFilters([...metadataFilters, ...fieldFilters]);

    // When opening a link that carries parser-dependent filters, make sure parsers are enabled so the
    // incoming filters produce valid queries (the user may have parsers disabled locally).
    this.enableParserIfRequiredByFilters();

    // Update the fields/metadata filters when the combined variable is changed in the variable UI.
    this._subs.add(fieldsAndMetadataVariable.subscribeToState(this.subscribeToCombinedFieldsVariable));

    const clearKeyBindings = setupKeyboardShortcuts(this);

    // If there is a mismatch between the cached singleton and the current state, make sure we update the singleton before the children scenes are activated
    if (
      this.state.embedded !== undefined &&
      this.state.embedded !== getMetadataService().getServiceSceneState()?.embedded
    ) {
      getMetadataService().setEmbedded(this.state.embedded);
    }

    this.setState({ currentFiltersMatchReference: this.currentFiltersMatchReference() });
    this._subs.add(
      getLabelsVariable(this).subscribeToState(async () => {
        this.setState({ currentFiltersMatchReference: this.currentFiltersMatchReference() });
      })
    );

    const assistantUnregister: Array<{ unregister(): void }> = [];
    this._subs.add(
      isAssistantAvailable().subscribe((isAvailable) => {
        if (isAvailable && !this.assistantInitialized) {
          assistantUnregister.push(this.provideAssistantQuestions());
          assistantUnregister.push(this.provideAssistantContext());
        }
      })
    );

    this._subs.add(this.subscribeToLokiConfigAPI());
    this._subs.add(this.subscribeToDataSourceChange());

    this.getDefaultColumnsFromAppPlatform();
    this.getDefaultLabelsAndSetContentScene();

    return () => {
      clearKeyBindings();
      assistantUnregister.forEach((callback) => callback.unregister());
    };
  }

  private async getDefaultColumnsFromAppPlatform() {
    if (isDefaultColumnsSupported()) {
      const dataSourceVariable = getDataSourceVariable(this);
      const dsUID = dataSourceVariable.state.value.toString();
      const metadataService = getMetadataService();
      const cachedRecords = metadataService.getDefaultColumns(dsUID);

      if (cachedRecords) {
        this.setState({
          defaultColumnsRecords: cachedRecords,
        });
      } else {
        const baseUrl = getAPIBaseURL('logsdrilldown.grafana.app', 'v1beta1');

        const request: Request = new Request(`${baseUrl}/logsdrilldowndefaultcolumns/${dsUID}`);
        const fetchResult = await fetch(request);

        if (fetchResult.ok) {
          const response = (await fetchResult.json()) as LogsDrilldownDefaultColumns;
          const records: LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords = response.spec.records;
          this.setState({
            defaultColumnsRecords: records,
          });
          getMetadataService().setDefaultColumns(records, dsUID);
        }
      }
    }
  }

  private async getDefaultLabelsAndSetContentScene() {
    // No need for fetching default labels when embedded or in service details
    if (this.state.embedded || this.userInServiceSelection() === false || isDefaultLabelsSupported() === false) {
      this.setState({
        contentScene: this.getContentScene(),
      });
      return;
    }

    const defaultLabelSettings = await getDefaultLabelSettings();
    getMetadataService().setDefaultLabels(defaultLabelSettings);

    // Avoid replacing with a new ServiceSelectionScene if we already have one (e.g. when
    // IndexScene.onActivate runs twice on navigate back), which would cause onActivate to fire twice.
    if (this.state.contentScene instanceof ServiceSelectionScene) {
      return;
    }

    const dsUID = getDataSourceVariable(this).getValue().toString();

    this.setState({
      contentScene: new ServiceSelectionScene({
        initialLabel: defaultLabelSettings ? defaultLabelSettings[dsUID]?.[0]?.label : undefined,
      }),
    });
  }

  public currentFiltersMatchReference() {
    const referenceLabelsDefined = this.state.referenceLabels && this.state.referenceLabels.length > 0;
    return (
      !referenceLabelsDefined ||
      areLabelFiltersEqual(this.state.referenceLabels || [], getLabelsVariable(this).state.filters)
    );
  }

  private userInServiceSelection() {
    const slug = getDrilldownSlug();
    return slug === PageSlugs.explore;
  }

  public getContentScene() {
    if (this.state.embedded) {
      const searchParams = urlUtil.getUrlSearchParams();
      const drillDownLabel = narrowDrilldownLabelFromSearchParams(searchParams);
      const pageSlug = narrowPageSlugFromSearchParams(searchParams);

      return new ServiceScene({
        drillDownLabel: drillDownLabel ? drillDownLabel : undefined,
        embedded: true,
        pageSlug: pageSlug ? pageSlug : PageSlugs.logs,
      });
    }

    if (this.userInServiceSelection()) {
      return new ServiceSelectionScene({});
    }

    return new ServiceScene({
      drillDownLabel: this.state.routeMatch?.params.breakdownLabel,
    });
  }

  private provideAssistantQuestions() {
    const slug = getDrilldownSlug();
    if (slug === PageSlugs.explore) {
      return provideServiceSelectionQuestions();
    } else {
      return provideServiceBreakdownQuestions();
    }
  }

  private subscribeToDataSourceChange() {
    return getDataSourceVariable(this).subscribeToState((newState, prevState) => {
      if (newState.value !== prevState.value) {
        this.state.$lokiConfig.runQueries();
        this.getDefaultColumnsFromAppPlatform();
      }
    });
  }

  /**
   * Subscribes to Loki config resource api call, sets response to IndexScene state
   * @todo clean this up if loki < 3.6 is not supported
   */
  private subscribeToLokiConfigAPI() {
    const isLokiConfigAPIAvailable = this.state.lokiConfig !== LOKI_CONFIG_API_NOT_SUPPORTED;
    if (isLokiConfigAPIAvailable && !this.state.$lokiConfig.state.data?.series.length) {
      // Check singleton for cached config for uncached scenes
      const lokiConfig = getMetadataService().getLokiConfig();
      if (lokiConfig) {
        this.setState({
          lokiConfig,
        });
      } else {
        this.state.$lokiConfig.runQueries();
      }
    }

    return this.state.$lokiConfig.subscribeToState((newState, prevState) => {
      // Loki versions before 3.6 will not have the new API endpoint, so we expect a 404 response
      if (newState.data?.state === LoadingState.Error) {
        this.setState({ lokiConfig: LOKI_CONFIG_API_NOT_SUPPORTED });
        getMetadataService().setLokiConfig(LOKI_CONFIG_API_NOT_SUPPORTED);
      } else if (newState.data?.state === LoadingState.Done && newState.data?.series.length > 0) {
        const lokiConfig = newState.data?.series[0].fields[0].values[0];
        if (lokiConfig) {
          // we can't subscribe to metadata singleton like we can scene state, so we shouldn't pull config from singleton except to set the initial indexScene state
          this.setState({ lokiConfig });
          getMetadataService().setLokiConfig(lokiConfig);
        }
      }
    });
  }

  private provideAssistantContext() {
    const setAssistantContext = providePageContext(`${PLUGIN_BASE_URL}/**`, []);

    this._subs.add(
      getDataSourceVariable(this).subscribeToState(async () => {
        await updateAssistantContext(this, setAssistantContext);
      })
    );
    this._subs.add(
      getLabelsVariable(this).subscribeToState(async () => {
        await updateAssistantContext(this, setAssistantContext);
      })
    );
    this._subs.add(
      getLevelsVariable(this).subscribeToState(async () => {
        await updateAssistantContext(this, setAssistantContext);
      })
    );
    this._subs.add(
      getFieldsVariable(this).subscribeToState(async () => {
        await updateAssistantContext(this, setAssistantContext);
      })
    );
    this.assistantInitialized = true;

    return setAssistantContext;
  }

  private subscribeToCombinedFieldsVariable = (
    newState: AdHocFiltersVariable['state'],
    prevState?: AdHocFiltersVariable['state']
  ) => {
    if (!areArraysEqual(newState.filters, prevState?.filters)) {
      const metadataFilters = newState.filters.filter((f: AdHocFiltersWithLabelsAndMeta) => isFilterMetadata(f));
      const fieldFilters = newState.filters.filter((f: AdHocFiltersWithLabelsAndMeta) => !isFilterMetadata(f));

      getFieldsVariable(this).updateFilters(fieldFilters);
      getMetadataVariable(this).updateFilters(metadataFilters);
    }
  };

  /**
   * Removes filters that can only work when parsers are enabled. Parsed-field filters and JSON-path
   * drill-downs (json fields / line format) require a `| json`/`| logfmt` parser stage, so they would
   * produce invalid queries once parsers are turned off. Structured-metadata filters are preserved as
   * they don't depend on a parser.
   */
  public clearParserDependentFilters() {
    const combinedVariable = getFieldsAndMetadataVariable(this);
    const metadataFilters = combinedVariable.state.filters.filter((f: AdHocFiltersWithLabelsAndMeta) =>
      isFilterMetadata(f)
    );
    // Updating the combined variable propagates to the fields and metadata variables via
    // `subscribeToCombinedFieldsVariable`, clearing the parsed fields while keeping metadata.
    if (metadataFilters.length !== combinedVariable.state.filters.length) {
      combinedVariable.updateFilters(metadataFilters);
    }

    const jsonFieldsVariable = getJSONFieldsVariable(this);
    if (jsonFieldsVariable.state.filters.length) {
      jsonFieldsVariable.setState({ filters: [] });
    }

    const lineFormatVariable = getLineFormatVariable(this);
    if (lineFormatVariable.state.filters.length) {
      lineFormatVariable.setState({ filters: [] });
    }
  }

  /**
   * Parsed-field, JSON-path and line-format filters require a parser stage. When a
   * link is opened with any of these filters present but the user has parsers disabled locally, the
   * filters would render invalid queries, so we re-enable parsers to honor the incoming filters.
   */
  private enableParserIfRequiredByFilters() {
    if (getParserEnabled()) {
      return;
    }

    const hasParsedFieldFilters = getFieldsVariable(this).state.filters.length > 0;
    const hasJsonFieldFilters = getJSONFieldsVariable(this).state.filters.length > 0;
    const hasLineFormatFilters = getLineFormatVariable(this).state.filters.length > 0;

    if (hasParsedFieldFilters || hasJsonFieldFilters || hasLineFormatFilters) {
      setParserEnabled(true, this);
    }
  }

  private setTagProviders() {
    this.setLabelsProviders();
  }

  private setLabelsProviders() {
    const labelsVar = getLabelsVariable(this);

    labelsVar._getOperators = () => operatorFunction(labelsVar);

    labelsVar.setState({
      getTagKeysProvider: getLabelsTagKeysProvider,
      getTagValuesProvider: getLabelsTagValuesProvider,
    });
  }

  private subscribeToPasteTimeEvent = async () => {
    const copiedRange = await getCopiedTimeRange();

    if (copiedRange.isError) {
      return;
    }

    const timeRange = sceneGraph.getTimeRange(this);
    const to = typeof copiedRange.range.to === 'string' ? copiedRange.range.to : undefined;
    const from = typeof copiedRange.range.from === 'string' ? copiedRange.range.from : undefined;
    const newRange = rangeUtil.convertRawToRange(copiedRange.range);

    if (timeRange && newRange) {
      timeRange.setState({
        from,
        to,
        value: newRange,
      });
    } else {
      logger.error(new Error('Invalid time range from clipboard'), {
        from: from ?? '',
        msg: 'Invalid time range from clipboard',
        sceneTimeRange: typeof timeRange,
        to: to ?? '',
      });
    }
  };

  /**
   * If user selects a time range longer then the max configured interval, show toast and set the previous time range.
   * @param timeRange
   * @private
   */
  private limitMaxInterval(timeRange: SceneTimeRangeLike) {
    return (newState: SceneTimeRangeState, prevState: SceneTimeRangeState) => {
      const { jsonData } = plugin.meta as AppPluginMeta<JsonData>;
      if (jsonData?.interval) {
        try {
          const maxInterval = rangeUtil.intervalToSeconds(jsonData?.interval ?? '');
          if (!maxInterval) {
            return;
          }
          const timeRangeInterval = newState.value.to.diff(newState.value.from, 'seconds');
          if (timeRangeInterval > maxInterval) {
            const prevInterval = prevState.value.to.diff(prevState.value.from, 'seconds');
            if (timeRangeInterval <= prevInterval) {
              timeRange.setState({
                from: prevState.from,
                to: prevState.to,
                value: prevState.value,
              });
            } else {
              const defaultRange = new SceneTimeRange(DEFAULT_TIME_RANGE);
              timeRange.setState({
                from: defaultRange.state.from,
                to: defaultRange.state.to,
                value: defaultRange.state.value,
              });
            }

            const appEvents = getAppEvents();
            appEvents.publish({
              payload: [`Time range interval exceeds maximum interval configured by the administrator.`],
              type: AppEvents.alertWarning.name,
            });

            reportAppInteraction('all', 'interval_too_long', {
              attempted_duration_seconds: timeRangeInterval,
              configured_max_interval: maxInterval,
            });
          }
        } catch (e) {
          console.error(e);
        }
      }
    };
  }

  private setVariableProviders() {
    const levelsVariable = getLevelsVariable(this);
    const fieldsCombinedVariable = getFieldsAndMetadataVariable(this);

    fieldsCombinedVariable._getOperators = () => operatorFunction(fieldsCombinedVariable);

    levelsVariable.setState({
      getTagKeysProvider: this.getLevelsTagKeysProvider(),
      getTagValuesProvider: this.getLevelsTagValuesProvider(),
    });

    fieldsCombinedVariable.setState({
      getTagKeysProvider: this.getCombinedFieldsTagKeysProvider(),
      getTagValuesProvider: this.getCombinedFieldsTagValuesProvider(),
    });
  }

  /**
   * Get tag keys (label names) for the combined fields variable
   */
  private getCombinedFieldsTagKeysProvider() {
    return (variable: AdHocFiltersVariable, currentKey: string | null) => {
      // Current key seems to always be null, I think it's only supported for other variable types that allow editing the key without first removing the value/operator?
      const metadataVar = getMetadataVariable(this);
      const fieldVar = getFieldsVariable(this);

      const uninterpolatedExpression = getFieldsTagValuesExpression(VAR_FIELDS_AND_METADATA);

      const metadataFilters = metadataVar.state.filters.filter((f) => f.key !== currentKey);
      const fieldFilters = fieldVar.state.filters.filter((f) => f.key !== currentKey);
      const otherFiltersString = this.renderVariableFilters(VAR_FIELDS, fieldFilters);
      const otherMetadataString = this.renderVariableFilters(VAR_METADATA, metadataFilters);
      const expr = uninterpolatedExpression
        .replace(PENDING_FIELDS_EXPR, otherFiltersString)
        .replace(PENDING_METADATA_EXPR, otherMetadataString);
      const interpolated = sceneGraph.interpolate(this, expr);

      return getFieldsKeysProvider({
        expr: interpolated,
        sceneRef: this,
        timeRange: sceneGraph.getTimeRange(this).state.value,
        variableType: VAR_FIELDS_AND_METADATA,
      });
    };
  }

  /**
   * Get tag values (label values) for combined fields variable
   */
  private getCombinedFieldsTagValuesProvider() {
    return (variable: AdHocFiltersVariable, filter: AdHocFilterWithLabels) => {
      const uninterpolatedExpression = getFieldsTagValuesExpression(VAR_FIELDS_AND_METADATA);
      const metadataVar = getMetadataVariable(this);
      const fieldVar = getFieldsVariable(this);

      const metadataFilters = metadataVar.state.filters.filter(
        (f) => f.key !== filter.key && isOperatorInclusive(f.operator)
      );
      const fieldFilters = fieldVar.state.filters.filter(
        (f) => f.key !== filter.key && isOperatorInclusive(f.operator)
      );

      const otherFiltersString = this.renderVariableFilters(VAR_FIELDS, fieldFilters);
      const otherMetadataString = this.renderVariableFilters(VAR_METADATA, metadataFilters);

      const expr = uninterpolatedExpression
        .replace(PENDING_FIELDS_EXPR, otherFiltersString)
        .replace(PENDING_METADATA_EXPR, otherMetadataString);

      const interpolated = interpolateExpression(this, expr);

      return getDetectedFieldValuesTagValuesProvider(
        filter,
        variable,
        interpolated,
        this,
        sceneGraph.getTimeRange(this).state.value,
        VAR_FIELDS_AND_METADATA
      );
    };
  }

  /**
   * Get tag keys (label names) for levels variable
   */
  private getLevelsTagKeysProvider() {
    return (variable: AdHocFiltersVariable, currentKey: string | null) => {
      // Current key seems to always be null, I think it's only supported for other variable types that allow editing the key without first removing the value/operator?
      const filters = variable.state.filters.filter((f) => f.key !== currentKey);
      const otherFiltersString = this.renderVariableFilters(VAR_LEVELS, filters);
      const uninterpolatedExpression = getFieldsTagValuesExpression(VAR_LEVELS);
      const expr = uninterpolatedExpression.replace(PENDING_FIELDS_EXPR, otherFiltersString);
      const interpolated = sceneGraph.interpolate(this, expr);
      return getFieldsKeysProvider({
        expr: interpolated,
        sceneRef: this,
        timeRange: sceneGraph.getTimeRange(this).state.value,
        variableType: VAR_LEVELS,
      });
    };
  }

  /**
   * Get tag values (label values) for levels variable
   */
  private getLevelsTagValuesProvider() {
    return (variable: AdHocFiltersVariable, filter: AdHocFilterWithLabels) => {
      // Don't add equals operations to the query, the user might want to select more than one value
      const filters = variable.state.filters.filter((f) => f.key !== filter.key && f.operator === FilterOp.Equal);
      const otherFiltersString = this.renderVariableFilters(VAR_LEVELS, filters);
      const uninterpolatedExpression = getFieldsTagValuesExpression(VAR_LEVELS);
      const expr = uninterpolatedExpression.replace(PENDING_FIELDS_EXPR, otherFiltersString);
      const interpolated = interpolateExpression(this, expr);

      const reusedLevels = getLevelsFromLogsVolume(this, otherFiltersString);
      if (reusedLevels) {
        return Promise.resolve({ replace: true, values: reusedLevels.map((text) => ({ text })) });
      }

      return getDetectedFieldValuesTagValuesProvider(
        filter,
        variable,
        interpolated,
        this,
        sceneGraph.getTimeRange(this).state.value,
        VAR_LEVELS
      );
    };
  }

  private renderVariableFilters(
    variableType: typeof VAR_FIELDS | typeof VAR_METADATA | typeof VAR_LEVELS,
    filters: AdHocFilterWithLabels[]
  ) {
    if (variableType === VAR_FIELDS) {
      return renderLogQLFieldFilters(filters);
    } else if (variableType === VAR_METADATA) {
      return renderLogQLMetadataFilters(filters);
    } else if (variableType === VAR_LEVELS) {
      return renderLogQLMetadataFilters(filters);
    } else {
      const error = new Error('getFieldsTagValuesProvider only supports fields, metadata, and levels');
      logger.error(error);
      throw error;
    }
  }

  /**
   * @todo why do we need to manually sync fields and levels, but not other ad hoc variables?
   * @param variable
   * @param urlParamName
   * @private
   */
  private resetVariablesIfNotInUrl(variable: AdHocFiltersVariable, urlParamName: string) {
    const location = locationService.getLocation();
    const search = new URLSearchParams(location.search);

    // Treat an absent OR empty param as "no filters in the URL". SceneAppPage caches scenes by pathname
    // (not query string), so navigating away and back re-shows a scene whose variables still hold stale
    // values while the URL now says empty (e.g. `var-jsonFields=`). Those filters are coming from the cache,
    // so clear them to sync with the URL. A non-empty value is a real filter and is left alone.
    const hasValueInUrl = search.getAll(urlParamName).some((value) => value !== '');
    if (!hasValueInUrl && variable.state.filters.length > 0) {
      variable.setState({ filters: [] });
    }
  }

  private updatePatterns(newState: IndexSceneState, patternsVariable: CustomVariable) {
    const patternsLine = renderPatternFilters(newState.patterns ?? []);
    patternsVariable.changeValueTo(patternsLine);
  }

  getUrlState() {
    return {
      patterns: JSON.stringify(this.state.patterns),
    };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const stateUpdate: Partial<IndexSceneState> = {};

    if (values.patterns && typeof values.patterns === 'string') {
      stateUpdate.patterns = JSON.parse(values.patterns) as AppliedPattern[];
    }

    this.setState(stateUpdate);
  }

  resetToReferenceQuery() {
    getLabelsVariable(this).setState({ filters: this.state.referenceLabels || [] });
  }
}

function getVariableSet(
  initialDatasourceUid: string,
  initialLabelFilters?: AdHocVariableFilter[],
  embedded?: boolean,
  defaultLineFilters?: LineFilterType[],
  initialFieldFilters?: AdHocFiltersWithLabelsAndMeta[]
) {
  const initialMetadataFilters = initialFieldFilters?.filter((f) => f.meta?.parser === 'structuredMetadata');
  const initialParsedFieldFilters = initialFieldFilters?.filter((f) => f.meta?.parser !== 'structuredMetadata');

  const parsersEnabled = getParserEnabled();
  const jsonParserSegment = getJsonParserSegment(parsersEnabled);
  const logfmtParserSegment = getLogfmtParserSegment(parsersEnabled);

  const labelVariable = new AdHocFiltersVariable({
    allowCustomValue: true,
    datasource: EXPLORATION_DS,
    description: t(
      'components.index-scene.get-variable-set.label-variable.description',
      'Filter logs by stream labels (for example job or namespace). Label filters are part of the Loki stream selector and apply before log pipelines.'
    ),
    expressionBuilder: renderLogQLLabelFilters,
    hide: VariableHide.dontHide,
    key: 'adhoc_service_filter',
    label: t('components.index-scene.get-variable-set.label-variable.label.labels', 'Labels'),
    layout: 'combobox',
    name: VAR_LABELS,
    onAddCustomValue: onAddCustomAdHocValue,
    filters: initialLabelFilters ?? [],
    inputPlaceholder: 'Filter by labels',
  });

  labelVariable._getOperators = function () {
    return operators;
  };

  const fieldsVariable = new AdHocFiltersVariable({
    allowCustomValue: true,
    applyMode: 'manual',
    expressionBuilder: renderLogQLFieldFilters,
    hide: VariableHide.hideVariable,
    label: t('components.index-scene.get-variable-set.fields-variable.label.detected-fields', 'Detected fields'),
    layout: 'combobox',

    name: VAR_FIELDS,
    filters: initialParsedFieldFilters ?? [],
  });

  fieldsVariable._getOperators = () => {
    return operators;
  };

  const metadataVariable = new AdHocFiltersVariable({
    allowCustomValue: true,
    applyMode: 'manual',
    expressionBuilder: (filters: AdHocFilterWithLabels[]) => renderLogQLMetadataFilters(filters),
    hide: VariableHide.hideVariable,
    label: t('components.index-scene.get-variable-set.metadata-variable.label.metadata', 'Metadata'),
    layout: 'combobox',
    name: VAR_METADATA,
    filters: initialMetadataFilters ?? [],
  });

  metadataVariable._getOperators = () => {
    return operators;
  };

  /**
   * Not used in interpolation, used as "proxy" variable that routes filters added in the variable UI
   * to the fields and metadata variables which are interpolated but not present in the UI.
   *
   * Not saved in the URL state, as on init we pull the values from the fields/metadata variables
   */
  const fieldsAndMetadataVariable = new AdHocFiltersVariable({
    allowCustomValue: true,
    applyMode: 'manual',
    description: t(
      'components.index-scene.get-variable-set.fields-and-metadata-variable.description',
      'Filter by extracted fields (JSON or logfmt, if enabled) and by structured metadata attached to each log line.'
    ),
    hide: VariableHide.hideVariable,
    label: t('components.index-scene.get-variable-set.fields-and-metadata-variable.label.fields', 'Fields'),
    layout: 'combobox',
    name: VAR_FIELDS_AND_METADATA,
    onAddCustomValue: onAddCustomFieldValue,
    skipUrlSync: true,
    inputPlaceholder: 'Filter by fields',
  });

  const levelsVariable = new AdHocFiltersVariable({
    applyMode: 'manual',
    expressionBuilder: renderLevelsFilter,
    hide: VariableHide.hideVariable,
    label: t('components.index-scene.get-variable-set.levels-variable.label.error-levels', 'Error levels'),
    layout: 'vertical',
    name: VAR_LEVELS,
    supportsMultiValueOperators: true,
  });

  const lineFiltersVariable = new AdHocFiltersVariable({
    expressionBuilder: renderLogQLLineFilter,
    filters:
      defaultLineFilters?.map((lineFilter, index) => ({
        ...lineFilter,
        keyLabel: index.toString(),
      })) ?? [],
    getTagKeysProvider: () => Promise.resolve({ replace: true, values: [] }),
    getTagValuesProvider: () => Promise.resolve({ replace: true, values: [] }),
    hide: VariableHide.hideVariable,
    layout: 'horizontal',
    name: VAR_LINE_FILTERS,
  });

  lineFiltersVariable._getOperators = () => {
    return lineFilterOperators;
  };

  const dsVariable = new DataSourceVariable({
    hide: embedded ? VariableHide.hideVariable : VariableHide.dontHide,
    label: t('components.index-scene.get-variable-set.ds-variable.label.data-source', 'Data source'),
    name: VAR_DATASOURCE,
    pluginId: 'loki',
    value: initialDatasourceUid,
  });

  const unsub = dsVariable.subscribeToState((newState) => {
    const dsValue = `${newState.value}`;
    newState.value && addLastUsedDataSourceToStorage(dsValue);
  });

  const jsonFieldsVar = new AdHocFiltersVariable({
    // debugging
    allowCustomValue: true,
    expressionBuilder: getJsonParserExpressionBuilder(),
    getTagKeysProvider: () => Promise.resolve({ replace: true, values: [] }),
    getTagValuesProvider: () => Promise.resolve({ replace: true, values: [] }),
    name: VAR_JSON_FIELDS,
  });

  const lineFormatVariable = new AdHocFiltersVariable({
    allowCustomValue: true,
    expressionBuilder: getLineFormatExpressionBuilder(),
    getTagKeysProvider: () => Promise.resolve({ replace: true, values: [] }),
    getTagValuesProvider: () => Promise.resolve({ replace: true, values: [] }),
    layout: 'horizontal',
    name: VAR_LINE_FORMAT,
  });

  return {
    unsub,
    variablesScene: new SceneVariableSet({
      variables: [
        lineFormatVariable,
        dsVariable,
        labelVariable,
        fieldsVariable,
        levelsVariable,
        metadataVariable,
        jsonFieldsVar,
        fieldsAndMetadataVariable,
        new CustomVariable({
          hide: VariableHide.hideVariable,
          name: VAR_PATTERNS,
          value: '',
        }),
        new AdHocFiltersVariable({
          expressionBuilder: renderLogQLLineFilter,
          hide: VariableHide.hideVariable,
          name: VAR_LINE_FILTER,
        }),
        lineFiltersVariable,

        // This variable is a hack to get logs context working, this variable should never be used or updated
        new CustomConstantVariable({
          hide: VariableHide.hideVariable,
          name: VAR_LOGS_FORMAT,
          options: [{ label: MIXED_FORMAT_EXPR, value: MIXED_FORMAT_EXPR }],
          skipUrlSync: true,
          value: MIXED_FORMAT_EXPR,
        }),

        // Parser pipeline segments toggled by the header "Parsers" switch. When parsers are disabled
        // both resolve to an empty string, removing the `| json ... | logfmt | drop ...` stages.
        new CustomConstantVariable({
          hide: VariableHide.hideVariable,
          name: VAR_JSON_PARSER,
          options: [{ label: jsonParserSegment, value: jsonParserSegment }],
          skipUrlSync: true,
          text: jsonParserSegment,
          value: jsonParserSegment,
        }),
        new CustomConstantVariable({
          hide: VariableHide.hideVariable,
          name: VAR_LOGFMT_PARSER,
          options: [{ label: logfmtParserSegment, value: logfmtParserSegment }],
          skipUrlSync: true,
          text: logfmtParserSegment,
          value: logfmtParserSegment,
        }),
      ],
    }),
  };
}
