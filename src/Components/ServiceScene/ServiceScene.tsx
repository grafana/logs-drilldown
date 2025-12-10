import React from 'react';

import { css } from '@emotion/css';

import { AppPluginMeta, LoadingState, PanelData } from '@grafana/data';
import {
  AdHocFiltersVariable,
  AdHocFilterWithLabels,
  QueryRunnerState,
  SceneComponentProps,
  SceneDataProvider,
  SceneDataState,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneQueryRunner,
  SceneVariableValueChangedEvent,
  VariableDependencyConfig,
} from '@grafana/scenes';
import { LogsSortOrder, VariableHide } from '@grafana/schema';
import { Alert, LoadingPlaceholder } from '@grafana/ui';

import { LogsDrilldownDefaultColumnsLogsDefaultColumnsRecord } from '../../lib/api-clients/logsdrilldown/v1alpha1';
import { plugin } from '../../module';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { areArraysEqual } from '../../services/comparison';
import { LOKI_CONFIG_API_NOT_SUPPORTED, LokiConfig, LokiConfigNotSupported } from '../../services/datasourceTypes';
import { PageSlugs, TabNames, ValueSlugs } from '../../services/enums';
import { replaceSlash } from '../../services/extensions/links';
import { clearJSONParserFields } from '../../services/fields';
import { filterUnusedJSONFilters } from '../../services/filters';
import { logger } from '../../services/logger';
import { getMetadataService } from '../../services/metadata';
import { migrateLineFilterV1 } from '../../services/migrations';
import { narrowPageOrValueSlug, narrowPageSlug, narrowValueSlug } from '../../services/narrowing';
import { navigateToDrilldownPage, navigateToIndex, navigateToValueBreakdown } from '../../services/navigate';
import { isOperatorInclusive } from '../../services/operatorHelpers';
import { getDrilldownSlug, getDrilldownValueSlug, getRouteParams } from '../../services/routing';
import { findObjectOfType } from '../../services/scenes';
import {
  getDataSourceVariable,
  getFieldsAndMetadataVariable,
  getFieldsVariable,
  getLabelsVariable,
  getLevelsVariable,
  getLineFiltersVariable,
  getLineFormatVariable,
  getMetadataVariable,
  getPatternsVariable,
} from '../../services/variableGetters';
import { JsonData } from '../AppConfig/AppConfig';
import { IndexScene, showLogsButtonSceneKey } from '../IndexScene/IndexScene';
import { LEVELS_VARIABLE_SCENE_KEY, LevelsVariableScene } from '../IndexScene/LevelsVariableScene';
import { ResetFiltersButton } from '../IndexScene/ResetFiltersButton';
import { ShowLogsButtonScene } from '../IndexScene/ShowLogsButtonScene';
import { ActionBarScene } from './ActionBarScene';
import { AddToDashboardModal } from './AddToDashboardModal';
import { breakdownViewsDefinitions, valueBreakdownViews } from './BreakdownViews';
import { getLogsPanelSortOrderFromURL } from './LogOptionsScene';
import { LogsListScene } from './LogsListScene';
import { drilldownLabelUrlKey, pageSlugUrlKey } from './ServiceSceneConstants';
import { AddToDashboardData, AddToDashboardEvent } from 'Components/Panels/PanelMenu';
import { LokiQueryDirection } from 'services/lokiQuery';
import { getQueryRunner, getResourceQueryRunner } from 'services/panel';
import { buildDataQuery, buildResourceQuery } from 'services/query';
import { getLogOption, getMaxLines } from 'services/store';
import {
  DETECTED_FIELD_VALUES_EXPR,
  EMPTY_VARIABLE_VALUE,
  isAdHocFilterValueUserInput,
  LEVEL_VARIABLE_VALUE,
  LOG_STREAM_SELECTOR_EXPR,
  SERVICE_NAME,
  SERVICE_UI_LABEL,
  stripAdHocFilterUserInputPrefix,
  VAR_DATASOURCE,
  VAR_FIELDS,
  VAR_LABELS,
  VAR_LABELS_EXPR,
  VAR_LEVELS,
  VAR_PATTERNS,
} from 'services/variables';

export const LOGS_PANEL_QUERY_REFID = 'logsPanelQuery';
export const LOGS_COUNT_QUERY_REFID = 'logsCountQuery';
const PATTERNS_QUERY_REFID = 'patterns';
const DETECTED_LABELS_QUERY_REFID = 'detectedLabels';
const DETECTED_FIELDS_QUERY_REFID = 'detectedFields';

type MakeOptional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

type ServiceSceneLoadingStates = {
  [name in TabNames]: boolean;
};

export interface ServiceSceneCustomState {
  embedded?: boolean;
  fieldsCount?: number;
  labelsCount?: number;
  loading?: boolean;
  logsCount?: number;
  patternsCount?: number;
  totalLogsCount?: number;
}

enum LabelFiltersInvalidReason {
  Empty = 'empty',
  PrimaryLabelRemoved = 'primary_label_removed',
}

type LabelFiltersStatus =
  | {
      isValid: true;
    }
  | {
      isValid: false;
      newPrimaryLabel?: AdHocFilterWithLabels<{}>;
      reason: LabelFiltersInvalidReason;
    };

export interface ServiceSceneState extends SceneObjectState, ServiceSceneCustomState {
  $data: SceneDataProvider | undefined;
  $detectedFieldsData: SceneQueryRunner | undefined;
  $detectedLabelsData: SceneQueryRunner | undefined;
  $logsCount: SceneQueryRunner | undefined;
  // null implies it is not supported, undefined is not set yet
  $patternsData?: SceneQueryRunner | undefined | null;
  addToDashboardData?: AddToDashboardData;
  body: SceneFlexLayout | undefined;
  defaultColumns?: string[];
  drillDownLabel?: string;
  loadingStates: ServiceSceneLoadingStates;
  pageSlug?: PageSlugs | ValueSlugs;
}

export function getLogsPanelFrame(data: PanelData | undefined) {
  return data?.series.find((series) => series.refId === LOGS_PANEL_QUERY_REFID);
}

export function getDetectedLabelsFrame(sceneRef: SceneObject) {
  const serviceScene = sceneGraph.getAncestor(sceneRef, ServiceScene);
  return serviceScene.state.$detectedLabelsData?.state.data?.series?.[0];
}

export function getDetectedFieldsFrame(sceneRef: SceneObject) {
  const serviceScene = sceneGraph.getAncestor(sceneRef, ServiceScene);
  return getDetectedFieldsFrameFromQueryRunnerState(serviceScene.state.$detectedFieldsData?.state);
}

export const getDetectedFieldsFrameFromQueryRunnerState = (state?: QueryRunnerState) => {
  // Only ever one frame in the response
  return state?.data?.series?.[0];
};

export const getDetectedFieldsNamesFromQueryRunnerState = (state: QueryRunnerState) => {
  // The first field, DETECTED_FIELDS_NAME_FIELD, has the list of names of the detected fields
  return state.data?.series?.[0]?.fields?.[0];
};

export const getDetectedFieldsParsersFromQueryRunnerState = (state: QueryRunnerState) => {
  // The third field, DETECTED_FIELDS_PARSER_NAME, has the list of parsers of the detected fields
  return state.data?.series?.[0]?.fields?.[2];
};

export class ServiceScene extends SceneObjectBase<ServiceSceneState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_DATASOURCE, VAR_LABELS, VAR_FIELDS, VAR_PATTERNS, VAR_LEVELS],
  });

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: [pageSlugUrlKey, drilldownLabelUrlKey] });

  public constructor(
    state: MakeOptional<
      ServiceSceneState,
      | '$data'
      | '$detectedFieldsData'
      | '$detectedLabelsData'
      | '$logsCount'
      | '$patternsData'
      | 'body'
      | 'loadingStates'
    >
  ) {
    super({
      $data: undefined,
      $detectedFieldsData: getDetectedFieldsQueryRunner(),
      $detectedLabelsData: getDetectedLabelsQueryRunner(),
      $logsCount: getLogCountQueryRunner(),
      body: state.body ?? buildGraphScene(),
      loading: true,
      loadingStates: {
        [TabNames.patterns]: false,
        [TabNames.labels]: false,
        [TabNames.fields]: false,
        [TabNames.logs]: false,
      },
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private handleInvalidLabels(reason: LabelFiltersInvalidReason, newPrimaryLabel?: AdHocFilterWithLabels) {
    if (reason === LabelFiltersInvalidReason.Empty) {
      if (!this.state.embedded) {
        this.redirectToStart();
      }
    }

    if (reason === LabelFiltersInvalidReason.PrimaryLabelRemoved) {
      // If we have a new label let's update the slugs in the url
      if (newPrimaryLabel) {
        let { breakdownLabel } = getRouteParams(this);
        this.handlePrimaryLabelChange(newPrimaryLabel, breakdownLabel);
      }
      // Otherwise we don't have any labels, redirect back to start
      else if (!this.state.embedded) {
        this.redirectToStart();
      }
    }
  }

  /**
   * Returns the correctness of the current label filters, and newPrimaryLabel if it's possible to switch over to a new primary label
   */
  public getLabelFiltersStatus(newFilters: AdHocFilterWithLabels[]): LabelFiltersStatus {
    const labelsVariable = getLabelsVariable(this);

    // check if we have any labels at all
    if (labelsVariable.state.filters.length === 0) {
      return { isValid: false, reason: LabelFiltersInvalidReason.Empty };
    }
    // check if we have any inclusive labels at all
    else {
      // If we remove the service name filter, we should redirect to the start
      let { labelName: primaryLabelInRoute, labelValue } = getRouteParams(this);

      // Before we dynamically pulled label filter keys into the URL, we had hardcoded "service" as the primary label slug, we want to keep URLs the same, so overwrite "service_name" with "service" if that's the primary label
      const isValidLegacyURL =
        primaryLabelInRoute === SERVICE_UI_LABEL &&
        newFilters.some(
          (f) =>
            f.key === SERVICE_NAME &&
            isOperatorInclusive(f.operator) &&
            replaceSlash(f.value) === replaceSlash(labelValue)
        );

      const primaryLabelMissingInFilters = !newFilters.some(
        (f) =>
          f.key === primaryLabelInRoute &&
          isOperatorInclusive(f.operator) &&
          replaceSlash(f.value) === replaceSlash(labelValue)
      );

      // The "primary" label used in the URL is no longer active, pick a new one
      if (primaryLabelMissingInFilters && !isValidLegacyURL) {
        const newPrimaryLabel = newFilters.find(
          (f) => isOperatorInclusive(f.operator) && f.value !== EMPTY_VARIABLE_VALUE
        );

        if (newPrimaryLabel) {
          return { isValid: false, reason: LabelFiltersInvalidReason.PrimaryLabelRemoved, newPrimaryLabel };
        } else {
          return { isValid: false, reason: LabelFiltersInvalidReason.PrimaryLabelRemoved };
        }
      }
    }

    return { isValid: true };
  }

  private setSubscribeToLabelsVariable() {
    const labelsVariable = getLabelsVariable(this);
    const status = this.getLabelFiltersStatus(labelsVariable.state.filters);
    if (!status.isValid) {
      this.handleInvalidLabels(status.reason, status.newPrimaryLabel);
    }

    this._subs.add(
      labelsVariable.subscribeToState((newState, prevState) => {
        const status = this.getLabelFiltersStatus(newState.filters);
        if (!status.isValid) {
          this.handleInvalidLabels(status.reason, status.newPrimaryLabel);
        }

        if (status.isValid && !areArraysEqual(newState.filters, prevState.filters)) {
          this.state.$patternsData?.runQueries();
          this.state.$detectedLabelsData?.runQueries();
          this.state.$detectedFieldsData?.runQueries();
          this.state.$logsCount?.runQueries();
          this.setDefaultColumns();
        }
      })
    );
  }

  private setDefaultColumns() {
    const indexScene = sceneGraph.getAncestor(this, IndexScene);
    const records = indexScene.state.defaultColumnsRecords;
    const labelsVariable = getLabelsVariable(this);
    const inclusiveFilters = labelsVariable.state.filters.filter((f) => isOperatorInclusive(f.operator));
    // Remove records that are more specific than our current label set
    const filteredRecords = records?.filter((f) => f.labels.length <= inclusiveFilters.length);

    // init map
    const filtersMap = new Map<string, string>();
    inclusiveFilters.forEach((f) => filtersMap.set(f.key, f.value));

    // Assign a score to each record
    const recordsScore: Array<LogsDrilldownDefaultColumnsLogsDefaultColumnsRecord & { score: number }> | undefined =
      filteredRecords?.map((r) => {
        const score = r.labels.reduce((accumulator, label) => {
          const mapValue = filtersMap.get(label.key);
          if (mapValue === label.value) {
            return accumulator + 1;
          }
          return accumulator;
        }, 0);
        return { ...r, score };
      });

    let highScore = 0;
    let highScoreIdx = -1;
    recordsScore?.forEach((r, idx) => {
      if (r.score > highScore) {
        highScore = r.score;
        highScoreIdx = idx;
      }
    });
    const bestMatch = highScoreIdx !== -1 ? recordsScore?.[highScoreIdx] : undefined;

    this.setState({
      defaultColumns: bestMatch?.columns,
    });
  }

  /**
   * Update url slugs when primary label has changed
   */
  private handlePrimaryLabelChange(newPrimaryLabel: AdHocFilterWithLabels<{}>, breakdownLabel: string | undefined) {
    const indexScene = sceneGraph.getAncestor(this, IndexScene);
    const prevRouteMatch = indexScene.state.routeMatch;

    const newPrimaryLabelValue = isAdHocFilterValueUserInput(newPrimaryLabel.value)
      ? replaceSlash(stripAdHocFilterUserInputPrefix(newPrimaryLabel.value))
      : replaceSlash(newPrimaryLabel.value);
    indexScene.setState({
      routeMatch: {
        ...prevRouteMatch,
        isExact: prevRouteMatch?.isExact ?? true,
        params: {
          ...prevRouteMatch?.params,
          labelName: newPrimaryLabel.key === SERVICE_NAME ? SERVICE_UI_LABEL : newPrimaryLabel.key,
          // If there are a bunch of values separated by pipe, like labels that come from explore, let's truncate the value so the slug doesn't get too long
          labelValue: newPrimaryLabelValue.split('|')[0],
        },
        path: prevRouteMatch?.path ?? '',
        url: prevRouteMatch?.url ?? '',
      },
    });

    // reset tab counts to trigger new queries after redirect
    this.resetTabCount();

    // If we don't have a breakdown label then the user has changed labels while in an aggregated breakdown or other top level slug (labels, fields, patterns, logs), redirect to fix any potentially invalid label slugs.
    if (!breakdownLabel) {
      const slug = this.getPageSlug();
      if (slug) {
        navigateToDrilldownPage(slug, this);
      } else {
        throw new Error(`Invalid page slug ${slug}`);
      }
      // If we have a breakdown label then the user has changed labels while in a value breakdown, redirect to fix any potentially invalid value slugs.
    } else {
      const valueSlug = this.getDrilldownValueSlug();
      if (valueSlug) {
        navigateToValueBreakdown(valueSlug, breakdownLabel, this);
      } else {
        throw new Error(`Invalid value slug ${valueSlug}`);
      }
    }
  }

  getPageSlug() {
    const drilldownSlug = narrowPageSlug(getDrilldownSlug());
    if (drilldownSlug && drilldownSlug !== PageSlugs.embed) {
      return drilldownSlug;
    }
    const narrowedPageSlug = narrowPageSlug(this.state.pageSlug);
    if (narrowedPageSlug) {
      return narrowedPageSlug;
    }

    return undefined;
  }

  private getDrilldownPageSlug() {
    const drilldownValueSlug = narrowValueSlug(getDrilldownValueSlug());
    if (drilldownValueSlug) {
      return drilldownValueSlug;
    }
    return this.state.pageSlug;
  }

  private getDrilldownValueSlug() {
    const drilldownValueSlug = narrowValueSlug(getDrilldownValueSlug());
    if (drilldownValueSlug) {
      return drilldownValueSlug;
    }
    return undefined;
  }

  private redirectToStart() {
    if (!this.state.embedded) {
      // Clear ongoing queries
      this.setState({
        $data: undefined,
        $detectedFieldsData: undefined,
        $detectedLabelsData: undefined,
        $logsCount: undefined,
        $patternsData: undefined,
        body: undefined,
        fieldsCount: undefined,
        labelsCount: undefined,
        logsCount: undefined,
        patternsCount: undefined,
        totalLogsCount: undefined,
      });
      getMetadataService().setServiceSceneState(this.state);
      this._subs.unsubscribe();

      // Redirect to root with updated params, which will trigger history push back to index route, preventing empty page or empty service query bugs
      navigateToIndex();
    } else {
      // Initial label set should be locked, so this should never happen when in an embedded state unless something has gone very wrong.
      console.error('Cannot redirect to start when embedded');
    }
  }

  private showVariables() {
    const levelsVar = sceneGraph.findByKeyAndType(this, LEVELS_VARIABLE_SCENE_KEY, LevelsVariableScene);
    levelsVar.setState({ visible: true });
    getFieldsAndMetadataVariable(this).setState({ hide: VariableHide.dontHide });
  }

  /**
   * After routing we need to pull any data set to the service scene by other routes from the metadata singleton,
   * as each route has a different instantiation of this scene
   * @private
   */
  private getMetadata() {
    const metadataService = getMetadataService();
    const state = metadataService.getServiceSceneState();

    if (state) {
      this.setState({
        ...state,
      });
    }
  }

  getUrlState() {
    return {
      drillDownLabel: this.state.drillDownLabel,
      pageSlug: this.state.pageSlug,
    };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const stateUpdate: Partial<ServiceSceneState> = {};

    // pageSlug and drillDownLabel url params are only used when embedded
    if (!this.state.embedded) {
      return;
    }

    if (values && typeof values.pageSlug === 'string' && values.pageSlug !== this.state.pageSlug) {
      const pageSlug = narrowPageOrValueSlug(values.pageSlug);
      if (pageSlug) {
        stateUpdate.pageSlug = pageSlug;
      }
    }

    const rawDrilldownLabel = values.drillDownLabel;
    // normalize drilldown label to prevent infinite render bugs introduced when embedded, some embedding applications routing causes unused url params to get passed as an empty string instead of null/undefined
    const normalizedDrillDownLabel =
      values.drillDownLabel && typeof rawDrilldownLabel === 'string' ? rawDrilldownLabel : undefined;

    if (
      (values && typeof rawDrilldownLabel === 'string' && normalizedDrillDownLabel !== this.state.drillDownLabel) ||
      (values.drillDownLabel === null && values.drillDownLabel !== this.state.drillDownLabel)
    ) {
      stateUpdate.drillDownLabel = normalizedDrillDownLabel;
    }

    if (Object.keys(stateUpdate).length) {
      this.setState(stateUpdate);
      // Need to manually re-render content scene when updated
      this.updateContentScene();
    }
  }

  private updateContentScene() {
    const indexScene = sceneGraph.getAncestor(this, IndexScene);
    indexScene.setState({
      contentScene: indexScene.getContentScene(),
    });
  }

  private onActivate() {
    let stateUpdate: Partial<ServiceSceneState> = {};

    if (!this.state.body) {
      stateUpdate.body = this.buildGraphScene();
    }
    if (!this.state.$data) {
      stateUpdate.$data = getLogsQueryQueryRunner(this);
    }

    if (Object.keys(stateUpdate).length) {
      this.setState(stateUpdate);
    }

    // Hide show logs button
    const showLogsButton = sceneGraph.findByKeyAndType(this, showLogsButtonSceneKey, ShowLogsButtonScene);
    showLogsButton.setState({ hidden: true });
    this.showVariables();
    this.getMetadata();
    this.resetBodyAndData();
    this.setBreakdownView();
    this.setDefaultColumns();

    // Run queries on activate
    this.runQueries();

    // API subscriptions
    this._subs.add(this.subscribeToLokiConfig());
    this._subs.add(this.subscribeToPatternsProvider());

    // Query Subscriptions
    this._subs.add(this.subscribeToPatternsQuery());
    this._subs.add(this.subscribeToDetectedLabelsQuery());

    // Fields tab will update its own count, and update count when a query fails
    this._subs.add(this.subscribeToDetectedFieldsQuery(this.getPageSlug() !== PageSlugs.fields));
    this._subs.add(this.subscribeToLogsQuery());
    this._subs.add(this.subscribeToLogsCountQuery());

    // Variable subscriptions
    this.setSubscribeToLabelsVariable();
    this._subs.add(this.subscribeToFieldsVariable());
    this._subs.add(this.subscribeToMetadataVariable());
    this._subs.add(this.subscribeToLevelsVariableChangedEvent());
    this._subs.add(this.subscribeToLevelsVariableFiltersState());
    this._subs.add(this.subscribeToDataSourceVariable());
    this._subs.add(this.subscribeToPatternsVariable());
    this._subs.add(this.subscribeToLineFiltersVariable());
    this._subs.add(this.subscribeToIndexSceneState());

    // Update query runner on manual time range change
    this._subs.add(this.subscribeToTimeRange());

    this._subs.add(this.subscribeToEvent(AddToDashboardEvent, this.subscribeToAddToDashboard));

    // Migrations
    migrateLineFilterV1(this);
  }

  private subscribeToPatternsProvider() {
    return this.subscribeToState((newState, prevState) => {
      // Run initial query
      if (newState.$patternsData && prevState.$patternsData === undefined) {
        newState.$patternsData.addActivationHandler(() => {
          newState.$patternsData?.runQueries();
        });
        newState.$patternsData.activate();
      }
    });
  }

  private subscribeToLokiConfig() {
    const indexScene = sceneGraph.getAncestor(this, IndexScene);
    return indexScene.subscribeToState((newState, prevState) => {
      if (newState.lokiConfig && newState.lokiConfig !== prevState.lokiConfig) {
        if (
          newState.lokiConfig === LOKI_CONFIG_API_NOT_SUPPORTED ||
          newState.lokiConfig?.pattern_ingester_enabled !== false
        ) {
          if (this.state.$patternsData === undefined) {
            this.setState({
              $patternsData: getPatternsQueryRunner(),
            });
            this._subs.add(this.subscribeToPatternsQuery());
          }
        } else {
          this.setState({
            $patternsData: null,
          });
        }
      }
    });
  }

  private subscribeToPatternsVariable() {
    return getPatternsVariable(this).subscribeToState((newState, prevState) => {
      if (newState.value !== prevState.value) {
        this.state.$detectedFieldsData?.runQueries();
        this.state.$logsCount?.runQueries();
      }
    });
  }

  private subscribeToIndexSceneState() {
    return sceneGraph.getAncestor(this, IndexScene).subscribeToState((newState, prevState) => {
      if (!areArraysEqual(newState.defaultColumnsRecords, prevState.defaultColumnsRecords)) {
        this.setDefaultColumns();
      }
    });
  }

  private subscribeToLineFiltersVariable() {
    return getLineFiltersVariable(this).subscribeToEvent(SceneVariableValueChangedEvent, () => {
      this.state.$logsCount?.runQueries();
      this.state.$detectedFieldsData?.runQueries();
    });
  }

  private subscribeToDataSourceVariable() {
    return getDataSourceVariable(this).subscribeToState(() => {
      this.redirectToStart();
    });
  }

  private resetTabCount() {
    this.setState({
      fieldsCount: undefined,
      labelsCount: undefined,
      patternsCount: undefined,
    });

    getMetadataService().setServiceSceneState(this.state);
  }

  private subscribeToFieldsVariable() {
    const fieldsVar = getFieldsVariable(this);

    return fieldsVar.subscribeToState((newState, prevState) => {
      if (!areArraysEqual(newState.filters, prevState.filters)) {
        this.removeInactiveJsonParserProps(newState, prevState);
        this.state.$detectedFieldsData?.runQueries();
        this.state.$logsCount?.runQueries();
      }
    });
  }

  /**
   * If we removed a filter from the ad-hoc variables, we need to remove old json parser props
   */
  private removeInactiveJsonParserProps(
    newState: AdHocFiltersVariable['state'],
    prevState: AdHocFiltersVariable['state']
  ) {
    const lineFormatVariable = getLineFormatVariable(this);
    if (!newState.filters.length && !lineFormatVariable.state.filters.length) {
      clearJSONParserFields(this);

      // A field was removed
    } else if (newState.filters.length < prevState.filters.length) {
      // If no other field filter has the same key, then we can remove the json parser
      const filterDiff = prevState.filters.filter(
        (prevFilter) => !newState.filters.find((newFilter) => newFilter.key === prevFilter.key)
      );

      if (filterDiff.length) {
        filterUnusedJSONFilters(this);
      }
    }
  }

  private subscribeToMetadataVariable() {
    const metadataVar = getMetadataVariable(this);
    return metadataVar.subscribeToState((newState, prevState) => {
      if (!areArraysEqual(newState.filters, prevState.filters)) {
        this.state.$detectedFieldsData?.runQueries();
        this.state.$logsCount?.runQueries();
      }
    });
  }

  /**
   * Subscribe to SceneVariableValueChangedEvent and run logs count and detectedFields on update.
   * In the levels variable renderer we update the ad-hoc filters, but we don't always want to immediately execute queries.
   */
  private subscribeToLevelsVariableChangedEvent() {
    return getLevelsVariable(this).subscribeToEvent(SceneVariableValueChangedEvent, () => {
      this.state.$detectedFieldsData?.runQueries();
    });
  }

  /**
   * Subscribe to actual filter changes and update the logs count
   * @private
   */
  private subscribeToLevelsVariableFiltersState() {
    const levelsVariable = getLevelsVariable(this);
    return levelsVariable.subscribeToState((newState, prevState) => {
      if (!areArraysEqual(newState.filters, prevState.filters)) {
        this.state.$logsCount?.runQueries();
      }
    });
  }

  private runQueries() {
    const slug = this.getPageSlug();
    const parentSlug = this.getDrilldownPageSlug();

    // If we don't have a patterns count in the tabs, or we are activating the patterns scene, run the pattern query
    if (slug === PageSlugs.patterns || this.state.patternsCount === undefined) {
      this.state.$patternsData?.runQueries();
    }

    // If we don't have a detected labels count, or we are activating the labels scene, run the detected labels query
    if (slug === PageSlugs.labels || parentSlug === ValueSlugs.label || this.state.labelsCount === undefined) {
      this.state.$detectedLabelsData?.runQueries();
    }

    // If we don't have a detected fields count, or we are activating the fields scene, run the detected fields query
    if (slug === PageSlugs.fields || parentSlug === ValueSlugs.field || this.state.fieldsCount === undefined) {
      this.state.$detectedFieldsData?.runQueries();
    }
    if (this.state.logsCount === undefined) {
      this.state.$logsCount?.runQueries();
    }
  }

  private subscribeToPatternsQuery() {
    return this.state.$patternsData?.subscribeToState((newState) => {
      this.updateLoadingState(newState, TabNames.patterns);
      if (newState.data?.state === LoadingState.Done) {
        const patternsResponse = newState.data.series;
        if (patternsResponse?.length !== undefined) {
          // Save the count of patterns to state
          this.setState({
            patternsCount: patternsResponse.length,
          });
          getMetadataService().setPatternsCount(patternsResponse.length);
        }
      }
    });
  }

  private subscribeToDetectedLabelsQuery() {
    return this.state.$detectedLabelsData?.subscribeToState((newState) => {
      this.updateLoadingState(newState, TabNames.labels);
      if (newState.data?.state === LoadingState.Done) {
        const detectedLabelsResponse = newState.data;
        // Detected labels API call always returns a single frame, with a field for each label
        const detectedLabelsFields = detectedLabelsResponse.series[0].fields;
        if (detectedLabelsResponse.series.length !== undefined && detectedLabelsFields.length !== undefined) {
          const removeSpecialFields = detectedLabelsResponse.series[0].fields.filter(
            (f) => LEVEL_VARIABLE_VALUE !== f.name
          );

          this.setState({
            labelsCount: removeSpecialFields.length + 1, // Add one for detected_level
          });
          getMetadataService().setLabelsCount(detectedLabelsFields.length);
        }
      }
    });
  }

  private updateLoadingState(newState: SceneDataState, key: keyof ServiceSceneLoadingStates) {
    const loadingStates = this.state.loadingStates;
    loadingStates[key] = newState.data?.state === LoadingState.Loading;
    // set loading state to true if any of the queries are loading
    const loading = Object.values(loadingStates).some((v) => v);
    this.setState({ loading, loadingStates });
  }

  private subscribeToLogsQuery() {
    return this.state.$data?.subscribeToState((newState, prevState) => {
      this.updateLoadingState(newState, TabNames.logs);
      if (newState.data?.state === LoadingState.Done || newState.data?.state === LoadingState.Streaming) {
        const resultCount = newState.data.series[0]?.length ?? 0;
        if (resultCount !== this.state.logsCount) {
          this.setState({
            logsCount: resultCount,
          });
        }
      }

      onQuery(newState, this);
    });
  }

  private subscribeToLogsCountQuery() {
    return this.state.$logsCount?.subscribeToState((newState) => {
      if (newState.data?.state === LoadingState.Done) {
        const value: number | undefined = newState.data.series[0]?.fields?.[1]?.values?.[0];
        this.setState({
          totalLogsCount: value,
        });
      }
    });
  }

  private subscribeToDetectedFieldsQuery(updateFieldsCount: boolean) {
    return this.state.$detectedFieldsData?.subscribeToState((newState) => {
      this.updateLoadingState(newState, TabNames.fields);
      const detectedFieldsResponse = newState.data;
      const detectedFieldsFrame = detectedFieldsResponse?.series[0];

      if (updateFieldsCount && newState.data?.state === LoadingState.Done) {
        if (detectedFieldsFrame !== undefined && detectedFieldsFrame.length !== this.state.fieldsCount) {
          this.setState({
            fieldsCount: detectedFieldsFrame.length,
          });
          getMetadataService().setFieldsCount(detectedFieldsFrame.length);
        }
      }
    });
  }

  private subscribeToTimeRange() {
    return sceneGraph.getTimeRange(this).subscribeToState(() => {
      this.state.$patternsData?.runQueries();
      this.state.$detectedLabelsData?.runQueries();
      this.state.$detectedFieldsData?.runQueries();
      this.state.$logsCount?.runQueries();
    });
  }

  private subscribeToAddToDashboard = (event: AddToDashboardEvent) => {
    this.setState({
      addToDashboardData: event.payload,
    });
  };

  public hideAddToDashboard = () => {
    this.setState({
      addToDashboardData: undefined,
    });
  };

  private resetBodyAndData = () => {
    let stateUpdate: Partial<ServiceSceneState> = {};

    if (!this.state.$data) {
      stateUpdate.$data = getLogsQueryQueryRunner(this);
    }

    if (!this.state.$patternsData) {
      const indexScene = sceneGraph.getAncestor(this, IndexScene);

      if (indexScene.state.lokiConfig) {
        stateUpdate.$patternsData = getPatternsQueryRunner(indexScene.state.lokiConfig);
        this._subs.add(this.subscribeToPatternsQuery());
      }
    }

    if (!this.state.$detectedLabelsData) {
      stateUpdate.$detectedLabelsData = getDetectedLabelsQueryRunner();
    }

    if (!this.state.$detectedFieldsData) {
      stateUpdate.$detectedFieldsData = getDetectedFieldsQueryRunner();
    }

    if (!this.state.$logsCount) {
      stateUpdate.$logsCount = getLogCountQueryRunner();
    }

    if (!this.state.body) {
      stateUpdate.body = this.buildGraphScene();
    }

    if (Object.keys(stateUpdate).length) {
      this.setState(stateUpdate);
    }
  };

  private buildGraphScene() {
    return new SceneFlexLayout({
      children: [
        new SceneFlexItem({
          body: new ActionBarScene({}),
          ySizing: 'content',
        }),
      ],
      direction: 'column',
    });
  }

  public setBreakdownView() {
    const { body } = this.state;
    const pageSlug = this.getPageSlug();
    const breakdownViewDef = breakdownViewsDefinitions.find((v) => v.value === pageSlug);

    if (!body) {
      const err = new Error('body is not defined in setBreakdownView!');
      logger.error(err, { msg: 'ServiceScene setBreakdownView error' });
      throw err;
    }

    if (breakdownViewDef) {
      body.setState({
        children: [
          ...body.state.children.slice(0, 1),
          breakdownViewDef.getScene((length) => {
            if (breakdownViewDef.value === 'fields') {
              this.setState({ fieldsCount: length });
            }
          }),
        ],
      });
    } else {
      const valueBreakdownView = this.getDrilldownPageSlug();
      const valueBreakdownViewDef = valueBreakdownViews.find((v) => v.value === valueBreakdownView);

      if (valueBreakdownViewDef && this.state.drillDownLabel) {
        body.setState({
          children: [...body.state.children.slice(0, 1), valueBreakdownViewDef.getScene(this.state.drillDownLabel)],
        });
      } else if (this.state.embedded) {
        // Must be embedded with unexpected slug
        const breakdown = breakdownViewsDefinitions[0];
        body.setState({
          children: [...body.state.children.slice(0, 1), breakdown.getScene((length) => {})],
        });
      } else {
        logger.error(new Error('not setting breakdown view'), { msg: 'setBreakdownView error' });
      }
    }
  }

  static Component = ({ model }: SceneComponentProps<ServiceScene>) => {
    const { body, addToDashboardData } = model.useState();
    const indexScene = sceneGraph.getAncestor(model, IndexScene);

    const { filters } = getLabelsVariable(model).useState();
    const status = model.getLabelFiltersStatus(filters);

    if (!status.isValid) {
      return (
        <Alert
          title={status.reason === LabelFiltersInvalidReason.Empty ? 'No labels selected' : 'Invalid labels selected'}
          severity="info"
        >
          <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' })}>
            {status.reason === LabelFiltersInvalidReason.PrimaryLabelRemoved && (
              <p>You need at least one label with inclusive matching.</p>
            )}
            {status.reason === LabelFiltersInvalidReason.Empty && (
              <p>Please select at least one label to see the logs breakdown.</p>
            )}
            <ResetFiltersButton indexScene={indexScene} />
          </div>
        </Alert>
      );
    }

    if (body) {
      return (
        <>
          {addToDashboardData && <AddToDashboardModal data={addToDashboardData} onClose={model.hideAddToDashboard} />}
          <body.Component model={body} />
        </>
      );
    }

    return <LoadingPlaceholder text={'Loading...'} />;
  };
}

function buildGraphScene() {
  return new SceneFlexLayout({
    children: [
      new SceneFlexItem({
        body: new ActionBarScene({}),
        ySizing: 'content',
      }),
    ],
    direction: 'column',
  });
}

function getPatternsQueryRunner(lokiConfig?: LokiConfig | LokiConfigNotSupported) {
  const { jsonData } = plugin.meta as AppPluginMeta<JsonData>;
  if (
    jsonData?.patternsDisabled ||
    (lokiConfig !== LOKI_CONFIG_API_NOT_SUPPORTED && lokiConfig?.pattern_ingester_enabled === false)
  ) {
    return null;
  }

  return getResourceQueryRunner(
    [buildResourceQuery(`{${VAR_LABELS_EXPR}}`, 'patterns', { refId: PATTERNS_QUERY_REFID })],
    { runQueriesMode: 'manual' }
  );
}

function getDetectedLabelsQueryRunner() {
  return getResourceQueryRunner(
    [buildResourceQuery(`{${VAR_LABELS_EXPR}}`, 'detected_labels', { refId: DETECTED_LABELS_QUERY_REFID })],
    { runQueriesMode: 'manual' }
  );
}

function getDetectedFieldsQueryRunner() {
  return getResourceQueryRunner(
    [buildResourceQuery(DETECTED_FIELD_VALUES_EXPR, 'detected_fields', { refId: DETECTED_FIELDS_QUERY_REFID })],
    { runQueriesMode: 'manual' }
  );
}

function getLogsQueryQueryRunner(sceneRef: SceneObject) {
  const query = {
    ...buildDataQuery(LOG_STREAM_SELECTOR_EXPR, { refId: LOGS_PANEL_QUERY_REFID }),
    get direction() {
      const sortOrder =
        getLogsPanelSortOrderFromURL() || getLogOption<LogsSortOrder>('sortOrder', LogsSortOrder.Descending);
      return sortOrder === LogsSortOrder.Descending ? LokiQueryDirection.Backward : LokiQueryDirection.Forward;
    },
    get maxLines() {
      return getMaxLines(sceneRef);
    },
  };

  return getQueryRunner([query], undefined);
}

function getLogCountQueryRunner() {
  const queryRunner = getQueryRunner(
    [
      buildDataQuery(`sum(count_over_time(${LOG_STREAM_SELECTOR_EXPR}[$__auto]))`, {
        queryType: 'instant',
        refId: LOGS_COUNT_QUERY_REFID,
      }),
    ],
    { runQueriesMode: 'manual' } // for some reason when this query is set to auto, it doesn't run on time range update, looks like there is different behavior with data providers not in the special $data prop
  );

  if (queryRunner instanceof SceneQueryRunner) {
    return queryRunner;
  }
  const error = new Error('log count query provider is not query runner!');
  logger.error(error, { msg: 'getLogCountQueryRunner: invalid return type' });
  throw error;
}

function onQuery(newState: SceneDataState, sceneObject: ServiceScene) {
  if (newState.data?.state === LoadingState.Done) {
    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.logs_on_query_complete,
      {
        vizType: findObjectOfType(sceneObject, (scene) => scene instanceof LogsListScene, LogsListScene)?.state
          .visualizationType,
        tab: sceneObject.getPageSlug(),
      }
    );
  } else if (newState.data?.state === LoadingState.Error) {
    reportAppInteraction(USER_EVENTS_PAGES.service_details, USER_EVENTS_ACTIONS.service_details.logs_on_query_error, {
      vizType: findObjectOfType(sceneObject, (scene) => scene instanceof LogsListScene, LogsListScene)?.state
        .visualizationType,
      errorCount: newState.data?.errors?.length,
      error: newState.data?.errors?.map((err) => err.message).join(', '),
      status: newState.data?.errors?.map((err) => err.status).join(', '),
      tab: sceneObject.getPageSlug(),
    });
  }
}
