import React from 'react';

import { css } from '@emotion/css';

import { ConfigOverrideRule, FieldColor, LoadingState } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridLayout,
  SceneDataNode,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
} from '@grafana/scenes';
import { LegendDisplayMode, PanelContext, SeriesVisibilityChangeMode } from '@grafana/ui';

import { areArraysEqual } from '../../../../services/comparison';
import { logger } from '../../../../services/logger';
import { isOperatorInclusive } from '../../../../services/operatorHelpers';
import { getLevelsVariable } from '../../../../services/variableGetters';
import { IndexScene } from '../../../IndexScene/IndexScene';
import { ServiceScene } from '../../ServiceScene';
import { onPatternClick } from './FilterByPatternsButton';
import { PatternFrame, PatternsBreakdownScene } from './PatternsBreakdownScene';
import { PatternsViewTableScene } from './PatternsViewTableScene';

const palette = config.theme2.visualization.palette;

export interface PatternsFrameSceneState extends SceneObjectState {
  body?: SceneCSSGridLayout;
  legendSyncPatterns: Set<string>;
  loading?: boolean;
}

export class PatternsFrameScene extends SceneObjectBase<PatternsFrameSceneState> {
  constructor(state?: Partial<PatternsFrameSceneState>) {
    super({
      loading: true,
      ...state,
      legendSyncPatterns: new Set(),
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  // parent render
  public static Component = ({ model }: SceneComponentProps<PatternsFrameScene>) => {
    const { body, loading } = model.useState();
    const logsByServiceScene = sceneGraph.getAncestor(model, ServiceScene);
    const { $patternsData } = logsByServiceScene.useState();
    const patterns = $patternsData?.state.data?.series;

    return (
      <div className={styles.container}>
        {!loading && patterns && patterns.length > 0 && <>{body && <body.Component model={body} />}</>}
      </div>
    );
  };

  private onActivate() {
    this.updateBody();
    const patternsBreakdownScene = sceneGraph.getAncestor(this, PatternsBreakdownScene);
    this.updatePatterns(patternsBreakdownScene.state.patternFrames);

    // If the patterns have changed, recalculate the dataframes
    this._subs.add(
      sceneGraph.getAncestor(this, ServiceScene).subscribeToState((newState, prevState) => {
        const newFrame = newState?.$patternsData?.state?.data?.series;
        const prevFrame = prevState?.$patternsData?.state?.data?.series;

        if (!areArraysEqual(newFrame, prevFrame)) {
          const patternsBreakdownScene = sceneGraph.getAncestor(this, PatternsBreakdownScene);
          this.updatePatterns(patternsBreakdownScene.state.patternFrames);

          // In order to keep the search state from clearing, we need to clear the filtered state
          patternsBreakdownScene.setState({
            filteredPatterns: undefined,
          });
        }
      })
    );

    // If the text search results have changed, update the components to use the filtered dataframe
    this._subs.add(
      sceneGraph.getAncestor(this, PatternsBreakdownScene).subscribeToState((newState, prevState) => {
        const patternsBreakdownScene = sceneGraph.getAncestor(this, PatternsBreakdownScene);
        if (newState.filteredPatterns && !areArraysEqual(newState.filteredPatterns, prevState.filteredPatterns)) {
          this.updatePatterns(patternsBreakdownScene.state.filteredPatterns);
        } else {
          // If there is no search string, clear the state
          if (!patternsBreakdownScene.state.patternFilter) {
            this.updatePatterns(patternsBreakdownScene.state.patternFrames);
          }
        }
      })
    );

    this._subs.add(
      getLevelsVariable(this).subscribeToState((newState, prevState) => {
        if (!areArraysEqual(newState.filters, prevState.filters)) {
          const patternsBreakdownScene = sceneGraph.getAncestor(this, PatternsBreakdownScene);
          this.updatePatterns(patternsBreakdownScene.state.patternFrames);
        }
      })
    );
  }

  private async updatePatterns(patternFrames: PatternFrame[] = []) {
    patternFrames = this.filterPatternFramesByLevel(patternFrames);

    // CSS Grid doesn't need rebuilding, just the children need the updated dataframe
    // @todo we should probably be setting the state on this scene and subscribing to it from the children
    this.state.body?.forEachChild((child) => {
      if (child instanceof VizPanel) {
        child.setState({
          $data: this.getTimeseriesDataNode(patternFrames),
        });
      }
      if (child instanceof PatternsViewTableScene) {
        child.setState({
          patternFrames,
        });
      }
    });
  }

  private filterPatternFramesByLevel = (patternFrames: PatternFrame[]) => {
    const levelsVar = getLevelsVariable(this);
    const filters = levelsVar.state.filters;

    if (
      filters.length &&
      patternFrames.some((patternFrame) => {
        return patternFrame.levels.length > 0;
      })
    ) {
      const levelsSet = new Set();
      filters.forEach((filter) => {
        if (isOperatorInclusive(filter.operator)) {
          levelsSet.add(filter.value);
        }
      });

      patternFrames = patternFrames.filter((patternFrame) => {
        return patternFrame.levels.some((level) => levelsSet.has(level));
      });
    }

    return patternFrames;
  };

  private async updateBody() {
    const patternsBreakdownScene = sceneGraph.getAncestor(this, PatternsBreakdownScene);
    const patternFrames = patternsBreakdownScene.state.patternFrames;

    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);

    const lokiPatterns = serviceScene.state.$patternsData?.state.data?.series;
    if (!lokiPatterns || !patternFrames) {
      logger.warn('Failed to update PatternsFrameScene body');
      return;
    }

    this.setState({
      body: this.getSingleViewLayout(),
      legendSyncPatterns: new Set(),
      loading: false,
    });
  }

  private extendTimeSeriesLegendBus(vizPanel: VizPanel, context: PanelContext) {
    const originalOnToggleSeriesVisibility = context.onToggleSeriesVisibility;

    context.onToggleSeriesVisibility = (label: string, mode: SeriesVisibilityChangeMode) => {
      originalOnToggleSeriesVisibility?.(label, mode);

      const override: ConfigOverrideRule | undefined = vizPanel.state.fieldConfig.overrides?.[0];
      const patternsToShow: string[] = override?.matcher.options.names;
      const legendSyncPatterns = new Set<string>();

      if (patternsToShow) {
        patternsToShow.forEach(legendSyncPatterns.add, legendSyncPatterns);
      }

      this.setState({
        legendSyncPatterns,
      });
    };
  }

  private getSingleViewLayout() {
    const patternsBreakdownScene = sceneGraph.getAncestor(this, PatternsBreakdownScene);
    const patternFrames = patternsBreakdownScene.state.patternFrames;

    if (!patternFrames) {
      logger.warn('Failed to set getSingleViewLayout');
      return;
    }

    const timeSeries = this.getTimeSeries(patternFrames);

    return new SceneCSSGridLayout({
      autoRows: '200px',
      children: [
        timeSeries,
        new PatternsViewTableScene({
          patternFrames,
        }),
      ],
      isLazy: true,

      templateColumns: '100%',
    });
  }

  private getTimeSeries(patternFrames: PatternFrame[]) {
    const logExploration = sceneGraph.getAncestor(this, IndexScene);

    const timeSeries = PanelBuilders.timeseries()
      .setData(this.getTimeseriesDataNode(patternFrames))
      .setOption('legend', {
        asTable: true,
        displayMode: LegendDisplayMode.Table,
        placement: 'right',
        showLegend: true,
        width: 200,
      })
      .setHoverHeader(true)
      .setUnit('short')
      .setLinks([
        {
          onClick: (event) => {
            onPatternClick({
              indexScene: logExploration,
              pattern: event.origin.labels.name,
              type: 'include',
            });
          },
          targetBlank: false,
          title: 'Include',
          url: '#',
        },
        {
          onClick: (event) => {
            onPatternClick({
              indexScene: logExploration,
              pattern: event.origin.labels.name,
              type: 'exclude',
            });
          },
          targetBlank: false,
          title: 'Exclude',
          url: '#',
        },
      ])
      .build();

    timeSeries.setState({
      extendPanelContext: (vizPanel, context) => this.extendTimeSeriesLegendBus(vizPanel, context),
    });

    return timeSeries;
  }

  private getTimeseriesDataNode(patternFrames: PatternFrame[]) {
    const timeRange = sceneGraph.getTimeRange(this).state.value;
    return new SceneDataNode({
      data: {
        series: patternFrames.map((patternFrame, seriesIndex) => {
          // Mutating the dataframe config here means that we don't need to update the colors in the table view
          const dataFrame = patternFrame.dataFrame;
          dataFrame.fields[1].config.color = overrideToFixedColor(seriesIndex);
          dataFrame.fields[1].name = '';
          return dataFrame;
        }),
        state: LoadingState.Done,
        timeRange: timeRange,
      },
    });
  }
}

export function overrideToFixedColor(key: keyof typeof palette): FieldColor {
  return {
    fixedColor: palette[key] as string,
    mode: 'fixed',
  };
}

const styles = {
  container: css({
    // Hide header on hover hack
    '.show-on-hover': {
      display: 'none',
    },
    width: '100%',
  }),
};
