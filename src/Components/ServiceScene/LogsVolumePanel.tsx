import React from 'react';

import { DataFrame, getValueFormat, LoadingState } from '@grafana/data';
import {
  PanelBuilders,
  SceneComponentProps,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
} from '@grafana/scenes';
import { LegendDisplayMode, PanelContext, SeriesVisibilityChangeMode, useStyles2 } from '@grafana/ui';

import { areArraysEqual } from '../../services/comparison';
import { getTimeSeriesExpr } from '../../services/expressions';
import { getFieldsVariable, getLabelsVariable, getLevelsVariable } from '../../services/variableGetters';
import { IndexScene } from '../IndexScene/IndexScene';
import { LevelsVariableScene } from '../IndexScene/LevelsVariableScene';
import { getPanelWrapperStyles, PanelMenu } from '../Panels/PanelMenu';
import { AddFilterEvent } from './Breakdowns/AddToFiltersButton';
import { LogsVolumeActions } from './LogsVolumeActions';
import { ServiceScene } from './ServiceScene';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { toggleLevelFromFilter } from 'services/levels';
import { getSeriesVisibleRange, getVisibleRangeFrame } from 'services/logsFrame';
import { getQueryRunner, setLogsVolumeFieldConfigs, syncLevelsVisibleSeries } from 'services/panel';
import { buildDataQuery, LINE_LIMIT } from 'services/query';
import { getLogsVolumeOption, setLogsVolumeOption } from 'services/store';
import { LEVEL_VARIABLE_VALUE } from 'services/variables';

export interface LogsVolumePanelState extends SceneObjectState {
  panel?: VizPanel;
}

export const logsVolumePanelKey = 'logs-volume-panel';
export class LogsVolumePanel extends SceneObjectBase<LogsVolumePanelState> {
  private updatedLogSeries: DataFrame[] | null = null;
  constructor(state: LogsVolumePanelState) {
    super({
      ...state,
      key: logsVolumePanelKey,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    if (!this.state.panel) {
      const panel = this.getVizPanel();
      this.setState({
        panel,
      });
      this.updateContainerHeight(panel);
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

    // Set Panel on fields variable filter update
    this._subs.add(
      fields.subscribeToState((newState, prevState) => {
        if (!areArraysEqual(newState.filters, prevState.filters)) {
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
  }

  private getTitle(totalLogsCount: number | undefined, logsCount: number | undefined) {
    const indexScene = sceneGraph.getAncestor(this, IndexScene);
    const maxLines = indexScene.state.ds?.maxLines ?? LINE_LIMIT;
    const valueFormatter = getValueFormat('short');
    const formattedTotalCount = totalLogsCount !== undefined ? valueFormatter(totalLogsCount, 0) : undefined;
    // The instant query (totalLogsCount) doesn't return good results for small result sets, if we're below the max number of lines, use the logs query result instead.
    if (totalLogsCount === undefined && logsCount !== undefined && logsCount < maxLines) {
      const formattedCount = valueFormatter(logsCount, 0);
      return formattedCount !== undefined
        ? `Log volume (${formattedCount.text}${formattedCount.suffix?.trim()})`
        : 'Log volume';
    }
    return formattedTotalCount !== undefined
      ? `Log volume (${formattedTotalCount.text}${formattedTotalCount.suffix?.trim()})`
      : 'Log volume';
  }

  private setCollapsed(collapsed: boolean | undefined, panel: VizPanel) {
    if (collapsed) {
      panel.setState({
        $data: undefined,
      });
    } else {
      panel.setState({
        $data: getQueryRunner([
          buildDataQuery(getTimeSeriesExpr(this, LEVEL_VARIABLE_VALUE, false), {
            legendFormat: `{{${LEVEL_VARIABLE_VALUE}}}`,
          }),
        ]),
      });
      this.subscribeToVisibleRange(panel);
    }
    this.updateContainerHeight(panel);
    setLogsVolumeOption('collapsed', collapsed ? 'true' : undefined);
  }

  private getVizPanel() {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    const isCollapsed = getLogsVolumeOption('collapsed');
    const viz = PanelBuilders.timeseries()
      .setTitle(this.getTitle(serviceScene.state.totalLogsCount, serviceScene.state.logsCount))
      .setOption('legend', { calcs: ['sum'], displayMode: LegendDisplayMode.List, showLegend: true })
      .setUnit('short')
      .setMenu(new PanelMenu({ investigationOptions: { labelName: 'level' } }))
      .setCollapsible(true)
      .setCollapsed(isCollapsed)
      .setHeaderActions(new LogsVolumeActions({}))
      .setShowMenuAlways(true)
      .setData(
        isCollapsed
          ? undefined
          : getQueryRunner([
              buildDataQuery(getTimeSeriesExpr(this, LEVEL_VARIABLE_VALUE, false), {
                legendFormat: `{{${LEVEL_VARIABLE_VALUE}}}`,
              }),
            ])
      );

    setLogsVolumeFieldConfigs(viz);

    const panel = viz.build();
    panel.setState({
      extendPanelContext: (_, context) => this.extendTimeSeriesLegendBus(context),
    });

    this._subs.add(
      panel.subscribeToState((newState, prevState) => {
        if (newState.collapsed !== prevState.collapsed) {
          this.setCollapsed(newState.collapsed, panel);
        }
      })
    );

    this.subscribeToVisibleRange(panel);

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
          if (!this.state.panel) {
            this.setState({
              panel: this.getVizPanel(),
            });
          } else {
            this.state.panel.setState({
              title: this.getTitle(newState.totalLogsCount, newState.logsCount),
            });
          }
        }
      })
    );

    return panel;
  }

  private subscribeToVisibleRange(panel: VizPanel) {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    this._subs.add(
      panel.state.$data?.subscribeToState((newState) => {
        if (newState.data?.state !== LoadingState.Done) {
          return;
        }
        if (serviceScene.state.$data?.state.data?.state === LoadingState.Done && !newState.data.annotations?.length) {
          this.updateVisibleRange(serviceScene.state.$data?.state.data?.series);
        } else {
          this.displayVisibleRange();
        }
        syncLevelsVisibleSeries(panel, newState.data.series, this);
      })
    );
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

  private extendTimeSeriesLegendBus = (context: PanelContext) => {
    const levelFilter = getLevelsVariable(this);
    this._subs.add(
      levelFilter?.subscribeToState(() => {
        const panel = this.state.panel;
        if (!panel?.state.$data?.state.data?.series) {
          return;
        }

        syncLevelsVisibleSeries(panel, panel?.state.$data?.state.data?.series, this);
      })
    );

    context.onToggleSeriesVisibility = (label: string, mode: SeriesVisibilityChangeMode) => {
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
    };
  };

  public static Component = ({ model }: SceneComponentProps<LogsVolumePanel>) => {
    const { panel } = model.useState();
    if (!panel) {
      return;
    }
    const styles = useStyles2(getPanelWrapperStyles);

    return (
      <span className={styles.panelWrapper}>
        <panel.Component model={panel} />
      </span>
    );
  };
}
