import React from 'react';

import { css } from '@emotion/css';

import { DataFrame, formattedValueToString, getValueFormat, LoadingState } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  PanelBuilders,
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
} from '@grafana/scenes';
import { DrawStyle, LegendDisplayMode, useStyles2 } from '@grafana/ui';

import { LogsFieldExtremesActions } from './LogsFieldExtremesActions';
import { LogsVolumeViewSwitch } from './LogsVolumeViewSwitch';
import { getPanelWrapperStyles, PanelMenu } from 'Components/Panels/PanelMenu';
import { getDetectedFieldsFrame, ServiceScene } from 'Components/ServiceScene/ServiceScene';
import { areArraysEqual } from 'services/comparison';
import { findExtremePoint, getExtremeValueFrame, getFieldNames } from 'services/fieldExtremes';
import { buildFieldsQueryString, getDetectedFieldType } from 'services/fields';
import { getSeriesVisibleRange, getVisibleRangeFrame } from 'services/logsFrame';
import { getQueryRunner } from 'services/panel';
import { buildDataQuery } from 'services/query';
import { syncLogsListPanelHeightFromScene } from 'services/scenes';
import { getLogsFieldExtremesField, setLogsFieldExtremesField } from 'services/store';
import { getFieldsVariable, getJSONFieldsVariable, getMetadataVariable } from 'services/variableGetters';
import { UnwrapRangeAggregation } from 'services/variables';

type ExtremeAggregation = Exclude<UnwrapRangeAggregation, 'avg'>;

interface LogsFieldExtremesPanelState extends SceneObjectState {
  aggregation: ExtremeAggregation;
  collapsed: boolean;
  field?: string;
  panel?: VizPanel;
}

export const logsFieldExtremesPanelKey = 'logs-field-extremes-panel';

/** The max or min of a numeric field per time bucket, shown in the space of the logs volume. */
export class LogsFieldExtremesPanel extends SceneObjectBase<LogsFieldExtremesPanelState> {
  constructor(state: Pick<LogsFieldExtremesPanelState, 'aggregation'>) {
    super({ collapsed: false, ...state, key: logsFieldExtremesPanelKey });
    this.addActivationHandler(this.onActivate.bind(this));
  }

  public setField(field: string) {
    if (field !== this.state.field) {
      setLogsFieldExtremesField(this, field);
      this.setState({ field });
      this.setPanel();
    }
  }

  public setAggregation(aggregation: ExtremeAggregation) {
    if (aggregation !== this.state.aggregation) {
      this.setState({ aggregation });
      this.setPanel();
    }
  }

  private onActivate() {
    this.selectDefaultField();
    this.setPanel();

    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    // The visible range follows the logs query, which can finish after this panel's own data.
    this._subs.add(
      serviceScene.state.$data?.subscribeToState((newState) => {
        if (newState.data?.state === LoadingState.Done) {
          this.applyAnnotations();
        }
      })
    );

    const detectedFieldsData = serviceScene.state.$detectedFieldsData;
    if (detectedFieldsData) {
      this._subs.add(
        detectedFieldsData.subscribeToState((state) => {
          if (!this.state.field && state.data?.state === LoadingState.Done && this.selectDefaultField()) {
            this.setPanel();
          }
        })
      );
    }

    // The parser and json paths in the query depend on the other field and metadata filters.
    const rebuildOnFiltersChange = (newFilters: Array<{ key: string }>, prevFilters: Array<{ key: string }>) => {
      if (!areArraysEqual(newFilters, prevFilters)) {
        this.setPanel();
      }
    };
    this._subs.add(
      getFieldsVariable(this).subscribeToState((newState, prevState) =>
        rebuildOnFiltersChange(newState.filters, prevState.filters)
      )
    );
    this._subs.add(
      getMetadataVariable(this).subscribeToState((newState, prevState) =>
        rebuildOnFiltersChange(newState.filters, prevState.filters)
      )
    );
  }

  private selectDefaultField() {
    if (this.state.field) {
      return false;
    }
    const { numeric, other } = getFieldNames(getDetectedFieldsFrame(this));
    const stored = getLogsFieldExtremesField(this);
    // Prefer the remembered field, otherwise the first detected numeric one.
    const field = [...numeric, ...other].find((name) => name === stored) ?? numeric[0];
    if (!field) {
      return false;
    }
    this.setState({ field });
    return true;
  }

  private getQueryExpr(field: string) {
    return buildFieldsQueryString(
      field,
      getFieldsVariable(this),
      getDetectedFieldsFrame(this),
      getJSONFieldsVariable(this),
      undefined,
      this.state.aggregation
    );
  }

  private getUnit() {
    const { field } = this.state;
    const fieldType = field ? getDetectedFieldType(field, getDetectedFieldsFrame(this)) : undefined;
    return fieldType === 'duration' ? 's' : fieldType === 'bytes' ? 'bytes' : 'short';
  }

  /** Marks the highest or lowest value and the time range of the logs on display, like the logs volume does. */
  private applyAnnotations() {
    const dataProvider = this.state.panel?.state.$data;
    const data = dataProvider?.state.data;
    if (!dataProvider || data?.state !== LoadingState.Done) {
      return;
    }

    const annotations: DataFrame[] = [];

    const logSeries = sceneGraph.getAncestor(this, ServiceScene).state.$data?.state.data;
    if (logSeries?.state === LoadingState.Done && logSeries.series.length > 0) {
      const { end, start } = getSeriesVisibleRange(logSeries.series);
      annotations.push(getVisibleRangeFrame(start, end));
    }

    const { aggregation } = this.state;
    const extreme = findExtremePoint(data.series, aggregation);
    if (extreme) {
      const value = formattedValueToString(getValueFormat(this.getUnit())(extreme.value));
      const text =
        aggregation === 'max'
          ? t('components.service-scene.logs-volume.field-extremes.annotation-max', 'Max: {{value}}', { value })
          : t('components.service-scene.logs-volume.field-extremes.annotation-min', 'Min: {{value}}', { value });
      annotations.push(getExtremeValueFrame(extreme.time, text));
    }

    if (annotations.length > 0) {
      dataProvider.setState({ data: { ...data, annotations } });
    }
  }

  private onCollapsedChange(isCollapsed: boolean) {
    this.setState({ collapsed: isCollapsed });
    this.setPanel();
    syncLogsListPanelHeightFromScene(sceneGraph.getAncestor(this, ServiceScene));
  }

  private setPanel() {
    this.setState({ panel: this.getVizPanel() });
  }

  private getVizPanel() {
    const { aggregation, collapsed, field } = this.state;
    const title = field
      ? aggregation === 'max'
        ? t('components.service-scene.logs-volume.field-extremes.title-max', 'Max of {{field}}', { field })
        : t('components.service-scene.logs-volume.field-extremes.title-min', 'Min of {{field}}', { field })
      : t('components.service-scene.logs-volume.field-extremes.title', 'Field extremes');

    const panel = PanelBuilders.timeseries()
      .setTitle(title)
      .setOption('legend', { calcs: [], displayMode: LegendDisplayMode.List, showLegend: false })
      .setNoValue(
        t('components.service-scene.logs-volume.field-extremes.no-value', 'No numeric values found for this field')
      )
      .setOption('annotations', { multiLane: true })
      .setUnit(this.getUnit())
      .setCustomFieldConfig('drawStyle', DrawStyle.Line)
      .setCustomFieldConfig('fillOpacity', 10)
      .setCustomFieldConfig('lineWidth', 1)
      .setMenu(new PanelMenu({}))
      .setCollapsible(true)
      .setCollapsed(collapsed)
      .setHeaderActions(
        new LogsFieldExtremesActions({
          collapsed,
          field,
          onFieldChange: (value) => this.setField(value),
          viewSwitch: new LogsVolumeViewSwitch({ view: aggregation }),
        })
      )
      .setShowMenuAlways(true)
      .setData(
        field && !collapsed
          ? getQueryRunner([buildDataQuery(this.getQueryExpr(field), { legendFormat: `${aggregation} ${field}` })])
          : undefined
      )
      .build();

    // New results come without annotations, so they are added each time a query completes.
    panel.state.$data?.subscribeToState((newState) => {
      if (newState.data?.state === LoadingState.Done && !newState.data.annotations?.length) {
        this.applyAnnotations();
      }
    });

    // Wrapped instead of subscribing to state so a strict mode activation cycle can't drop the handler.
    const toggleCollapse = panel.onToggleCollapse;
    panel.onToggleCollapse = (isCollapsed: boolean) => {
      toggleCollapse(isCollapsed);
      this.onCollapsedChange(isCollapsed);
    };

    return panel;
  }

  public static Component = ({ model }: SceneComponentProps<LogsFieldExtremesPanel>) => {
    const { collapsed, panel } = model.useState();
    const styles = useStyles2(getStyles);
    const panelStyles = useStyles2(getPanelWrapperStyles);

    if (!panel) {
      return null;
    }

    return (
      <div className={collapsed ? styles.collapsed : styles.expanded}>
        <div className={panelStyles.panelWrapper}>
          <panel.Component model={panel} />
        </div>
      </div>
    );
  };
}

// Same heights as the logs volume panel, which this one replaces while it is shown.
const getStyles = () => ({
  collapsed: css({ height: 35, position: 'relative' }),
  expanded: css({ height: Math.max(Math.round(window.innerHeight * 0.2), 100), position: 'relative' }),
});
