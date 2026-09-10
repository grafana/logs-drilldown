import React from 'react';

import { Unsubscribable } from 'rxjs';

import {
  DataFrame,
  FormattedValue,
  formattedValueToString,
  getValueFormat,
  LoadingState,
  ValueFormatter,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  PanelBuilders,
  SceneComponentProps,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
} from '@grafana/scenes';
import {
  DrawStyle,
  LegendDisplayMode,
  PanelContext,
  SeriesVisibilityChangeMode,
  StackingMode,
  useStyles2,
} from '@grafana/ui';

import { LevelsVariableScene } from 'Components/IndexScene/LevelsVariableScene';
import { getPanelWrapperStyles, PanelMenu } from 'Components/Panels/PanelMenu';
import { AddFilterEvent } from 'Components/ServiceScene/Breakdowns/AddToFiltersButton';
import { MAX_NUMBER_OF_TIME_SERIES } from 'Components/ServiceScene/Breakdowns/TimeSeriesLimit';
import { LogsVolumeActions } from 'Components/ServiceScene/LogsVolumeActions';
import { ServiceScene } from 'Components/ServiceScene/ServiceScene';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { areArraysEqual } from 'services/comparison';
import { excludeAggregateByFromLogsVolumeQuery, getLogsVolumeQuery } from 'services/expressions';
import { getParserForField } from 'services/fields';
import { toggleFieldFromFilter } from 'services/labels';
import { toggleLevelFromFilter } from 'services/levels';
import { getSeriesVisibleRange, getVisibleRangeFrame } from 'services/logsFrame';
import { sumLogsVolumeSeries } from 'services/logsVolume';
import {
  getQueryRunner,
  setLogsVolumeFieldConfigOverrides,
  syncLevelsVisibleSeries,
  syncLogsVolumeVisibleSeries,
} from 'services/panel';
import { buildDataQuery } from 'services/query';
import { syncLogsListPanelHeightFromScene } from 'services/scenes';
import {
  getLogsVolumeAggregateBy,
  getLogsVolumeOption,
  getMaxLines,
  setLogsVolumeAggregateBy,
  setLogsVolumeOption,
} from 'services/store';
import { getFieldsVariable, getLabelsVariable, getLevelsVariable, getMetadataVariable } from 'services/variableGetters';
import { LEVEL_VARIABLE_VALUE } from 'services/variables';

export interface LogsVolumePanelState extends SceneObjectState {
  aggregateBy: string;
  panel?: VizPanel;
}

export const logsVolumePanelKey = 'logs-volume-panel';

export class LogsVolumePanel extends SceneObjectBase<LogsVolumePanelState> {
  private updatedLogSeries: DataFrame[] | null = null;
  private visibleRangeSub?: Unsubscribable;
  constructor(state: Omit<LogsVolumePanelState, 'aggregateBy'>) {
    super({
      ...state,
      aggregateBy: LEVEL_VARIABLE_VALUE,
      key: logsVolumePanelKey,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  public isAggregatingByLevel() {
    return this.state.aggregateBy === LEVEL_VARIABLE_VALUE;
  }

  public setAggregateBy(field: string) {
    if (field === this.state.aggregateBy) {
      return;
    }
    const previousField = this.state.aggregateBy ?? LEVEL_VARIABLE_VALUE;
    setLogsVolumeAggregateBy(this, field === LEVEL_VARIABLE_VALUE ? undefined : field);
    this.setState({ aggregateBy: field });
    this.updateVolumeQuery();
    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.logs_volume_aggregate_by_changed,
      {
        field,
        previousField,
      }
    );
  }

  private updateVolumeQuery() {
    const panel = this.state.panel;
    if (!panel) {
      return;
    }

    const actions = panel.state.headerActions;
    if (actions instanceof LogsVolumeActions) {
      actions.setState({ aggregateBy: this.state.aggregateBy });
    }

    panel.setState({ $data: getQueryRunner([this.getVolumeQuery()]) });
    this.subscribeToVisibleRange(panel);
  }

  private restoreAggregateBy() {
    const aggregateBy = getLogsVolumeAggregateBy(this) ?? LEVEL_VARIABLE_VALUE;
    if (aggregateBy !== this.state.aggregateBy) {
      this.setState({ aggregateBy });
    }
  }

  private getVolumeQuery() {
    return buildDataQuery(this.getVolumeQueryExpr(), {
      legendFormat: `{{${this.state.aggregateBy}}}`,
    });
  }

  private getVolumeQueryExpr() {
    return excludeAggregateByFromLogsVolumeQuery(
      getLogsVolumeQuery(this, this.state.aggregateBy),
      this.state.aggregateBy,
      this
    );
  }

  private onActivate() {
    this.restoreAggregateBy();
    this._subs.add(() => this.visibleRangeSub?.unsubscribe());

    // No need to wait for detectedFields.
    if (this.state.aggregateBy === LEVEL_VARIABLE_VALUE) {
      this.setPanel();
    }

    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    const detectedFieldsData = serviceScene.state.$detectedFieldsData;
    if (detectedFieldsData) {
      this._subs.add(
        detectedFieldsData.subscribeToState((state) => {
          if (!this.state.panel && state.data?.state === LoadingState.Done) {
            this.setPanel();
          }
        })
      );
    }

    const labels = getLabelsVariable(this);
    const fields = getFieldsVariable(this);

    // Set panel on labels variable filter update
    this._subs.add(
      labels.subscribeToState((newState, prevState) => {
        if (!areArraysEqual(newState.filters, prevState.filters)) {
          this.setState({
            panel: this.getVizPanel(),
          });
        }
      })
    );

    // Recreate the panel when other field filters change; the grouped-by field is focused instead.
    this._subs.add(
      fields.subscribeToState((newState, prevState) => {
        if (this.filtersChangedExcept(newState.filters, prevState.filters, this.state.aggregateBy)) {
          this.setState({
            panel: this.getVizPanel(),
          });
        }
      })
    );

    // Recreate when other metadata filters change; the grouped-by field is excluded from the query.
    this._subs.add(
      getMetadataVariable(this).subscribeToState((newState, prevState) => {
        if (this.isAggregatingByLevel() || getParserForField(this.state.aggregateBy, this) !== 'structuredMetadata') {
          return;
        }
        if (this.filtersChangedExcept(newState.filters, prevState.filters, this.state.aggregateBy)) {
          this.setState({
            panel: this.getVizPanel(),
          });
        }
      })
    );

    // trigger variable render on AddFilterEvent, set filter state to trigger logs panel query
    this._subs.add(
      this.subscribeToEvent(AddFilterEvent, (event) => {
        if (event.key === LEVEL_VARIABLE_VALUE) {
          const levelsVariableScene = sceneGraph.findObject(this, (obj) => obj instanceof LevelsVariableScene);
          if (levelsVariableScene instanceof LevelsVariableScene) {
            const levelsVar = getLevelsVariable(this);
            levelsVar.setState({ filters: levelsVar.state.filters });
          }
        }
      })
    );

    this._subs.add(
      serviceScene.state.$data?.subscribeToState((newState) => {
        if (newState.data?.state === LoadingState.Done) {
          this.updateVisibleRange(newState.data.series);
        }
      })
    );

    this._subs.add(
      serviceScene.subscribeToState((newState, prevState) => {
        if (newState.totalLogsCount !== prevState.totalLogsCount || newState.logsCount !== undefined) {
          this.state.panel?.setState({
            title: this.getTitle(),
          });
        }
      })
    );

    this._subs.add(
      getLevelsVariable(this).subscribeToState((newState, prevState) => {
        if (areArraysEqual(newState.filters, prevState.filters) || !this.state.panel) {
          return;
        }
        this.state.panel.setState({
          title: this.getTitle(),
        });
      })
    );
  }

  private setPanel() {
    const panel = this.getVizPanel();
    this.setState({
      panel,
    });
    this.updateContainerHeight(panel);
  }

  private getTitle() {
    const isCollapsed = getLogsVolumeOption('collapsed');
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    // Instant query or logs volume count
    const totalLogsCount = this.getVolumeOrInstantQueryCount();
    // Logs Panel response count
    const logsCount = serviceScene.state.logsCount;

    const maxLines = getMaxLines(this);

    const title = t('components.service-scene.logs-volume.logs-volume-panel.title', 'Log volume');

    // Potentially inaccurate, wait for logsCount
    if (totalLogsCount !== undefined && totalLogsCount < maxLines && logsCount === undefined) {
      return title;
    }

    let valueFormatter: ValueFormatter;
    let formattedCount: FormattedValue | undefined = undefined;

    // The instant query (totalLogsCount) doesn't return good results for small result sets, if we're below the max number of lines, use the logs query result instead.
    if (logsCount !== undefined && logsCount < maxLines) {
      valueFormatter = getValueFormat('locale');
      formattedCount = valueFormatter(logsCount, 0);
    } else if (totalLogsCount !== undefined) {
      // The instant query can be inaccurate, so we show a short version of the number. A full-range logs volume query will return the correct count.
      valueFormatter = getValueFormat(isCollapsed ? 'short' : 'locale');
      formattedCount = valueFormatter(totalLogsCount, 0);
    }

    return formattedCount !== undefined
      ? t(
          'components.service-scene.logs-volume.logs-volume-panel.title-with-count',
          'Log volume ({{formattedCount}})',
          {
            formattedCount: formattedValueToString(formattedCount),
          }
        )
      : title;
  }

  private getVolumeOrInstantQueryCount = () => {
    const panelData = this.state.panel?.state.$data?.state.data;
    if (panelData?.series) {
      return sumLogsVolumeSeries(panelData.series, this);
    }

    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    return serviceScene.state.totalLogsCount;
  };

  private setCollapsed(collapsed: boolean | undefined) {
    setLogsVolumeOption('collapsed', collapsed ? 'true' : undefined);
    this.setPanel();
    syncLogsListPanelHeightFromScene(sceneGraph.getAncestor(this, ServiceScene));
  }

  private getVizPanel() {
    const isCollapsed = getLogsVolumeOption('collapsed');
    // Overrides are defined by setLogsVolumeFieldConfigOverrides, any overrides added here will be overwritten!
    const viz = PanelBuilders.timeseries()
      .setTitle(this.getTitle())
      .setOption('legend', {
        calcs: ['sum'],
        displayMode: LegendDisplayMode.List,
        showLegend: true,
      })
      .setOption('annotations', { multiLane: true })
      .setDisplayMode('default')
      .setUnit('short')
      .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
      .setCustomFieldConfig('fillOpacity', 100)
      .setCustomFieldConfig('lineWidth', 0)
      .setCustomFieldConfig('pointSize', 0)
      .setCustomFieldConfig('axisSoftMin', 0)
      .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
      .setMenu(new PanelMenu({}))
      .setCollapsible(true)
      .setCollapsed(isCollapsed)
      .setHeaderActions(
        new LogsVolumeActions({
          aggregateBy: this.state.aggregateBy,
          onAggregateByChange: (field) => this.setAggregateBy(field),
        })
      )
      .setShowMenuAlways(true)
      .setSeriesLimit(MAX_NUMBER_OF_TIME_SERIES)
      .setData(isCollapsed ? undefined : getQueryRunner([this.getVolumeQuery()]));

    setLogsVolumeFieldConfigOverrides(viz);

    const panel = viz.build();
    panel.setState({
      extendPanelContext: (_, context) => this.extendTimeSeriesLegendBus(context),
    });

    this._subs.add(
      panel.subscribeToState((newState, prevState) => {
        if (newState.collapsed !== prevState.collapsed) {
          this.setCollapsed(newState.collapsed);
        }
      })
    );

    this.subscribeToVisibleRange(panel);

    return panel;
  }

  private subscribeToVisibleRange(panel: VizPanel) {
    this.visibleRangeSub?.unsubscribe();
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    this.visibleRangeSub = panel.state.$data?.subscribeToState((newState) => {
      if (newState.data?.state !== LoadingState.Done) {
        return;
      }
      if (serviceScene.state.$data?.state.data?.state === LoadingState.Done && !newState.data.annotations?.length) {
        this.updateVisibleRange(serviceScene.state.$data?.state.data?.series);
      } else {
        this.displayVisibleRange();
      }
      this.syncVisibleSeries(panel, newState.data.series);
      panel.setState({
        title: this.getTitle(),
      });
    });
  }

  public updateContainerHeight(panel: VizPanel) {
    const containerLayout = sceneGraph.getAncestor(panel, SceneFlexLayout);
    const height = panel.state.collapsed ? 35 : Math.max(Math.round(window.innerHeight * 0.2), 100);
    containerLayout.setState({
      height: height,
      maxHeight: height,
      minHeight: height,
    });
  }

  public updateVisibleRange(data: DataFrame[] = []) {
    this.updatedLogSeries = data;
    this.displayVisibleRange();
  }

  private displayVisibleRange() {
    const panel = this.state.panel;
    if (
      !panel ||
      !panel.state.$data?.state.data ||
      panel.state.$data?.state.data.state !== LoadingState.Done ||
      !this.updatedLogSeries
    ) {
      return;
    }
    const visibleRange = getSeriesVisibleRange(this.updatedLogSeries);
    this.updatedLogSeries = null;
    panel.state.$data.setState({
      data: {
        ...panel.state.$data.state.data,
        annotations: [getVisibleRangeFrame(visibleRange.start, visibleRange.end)],
      },
    });
  }

  private filtersChangedExcept(
    newFilters: Array<{ key: string }>,
    prevFilters: Array<{ key: string }>,
    exceptKey: string
  ) {
    return !areArraysEqual(
      newFilters.filter((filter) => filter.key !== exceptKey),
      prevFilters.filter((filter) => filter.key !== exceptKey)
    );
  }

  private syncVisibleSeries(panel: VizPanel, series: DataFrame[]) {
    if (this.isAggregatingByLevel()) {
      syncLevelsVisibleSeries(panel, series, this);
      return;
    }
    syncLogsVolumeVisibleSeries(this.state.aggregateBy, panel, series, this);
  }

  private extendTimeSeriesLegendBus = (context: PanelContext) => {
    const syncFromFilters = () => {
      const panel = this.state.panel;
      const series = panel?.state.$data?.state.data?.series;
      if (!panel || !series) {
        return;
      }
      this.syncVisibleSeries(panel, series);
    };

    this._subs.add(getLevelsVariable(this)?.subscribeToState(syncFromFilters));
    this._subs.add(getFieldsVariable(this)?.subscribeToState(syncFromFilters));
    this._subs.add(getMetadataVariable(this)?.subscribeToState(syncFromFilters));

    context.onToggleSeriesVisibility = (label: string | string[] | null, mode: SeriesVisibilityChangeMode) => {
      if (label == null || Array.isArray(label)) {
        return;
      }

      if (this.isAggregatingByLevel()) {
        const action = toggleLevelFromFilter(label, this);
        this.publishEvent(new AddFilterEvent('legend', 'include', LEVEL_VARIABLE_VALUE, label), true);

        reportAppInteraction(
          USER_EVENTS_PAGES.service_details,
          USER_EVENTS_ACTIONS.service_details.level_in_logs_volume_clicked,
          {
            action,
            level: label,
          }
        );
        return;
      }

      const field = this.state.aggregateBy;
      const action = toggleFieldFromFilter(field, label, this);
      this.publishEvent(new AddFilterEvent('legend', 'include', field, label), true);

      reportAppInteraction(
        USER_EVENTS_PAGES.service_details,
        USER_EVENTS_ACTIONS.service_details.level_in_logs_volume_clicked,
        {
          action,
          field,
          value: label,
        }
      );
    };
  };

  public static Component = ({ model }: SceneComponentProps<LogsVolumePanel>) => {
    const { panel } = model.useState();
    const styles = useStyles2(getPanelWrapperStyles);
    if (!panel) {
      return;
    }

    return (
      <div className={styles.panelWrapper}>
        <panel.Component model={panel} />
      </div>
    );
  };
}
