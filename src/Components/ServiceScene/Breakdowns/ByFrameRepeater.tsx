import React from 'react';

import { css } from '@emotion/css';
import { map, Observable } from 'rxjs';

import { DataFrame, LoadingState, PanelData } from '@grafana/data';
import {
  SceneByFrameRepeater,
  SceneComponentProps,
  SceneDataTransformer,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneLayout,
  SceneObjectBase,
  SceneObjectState,
  SceneReactObject,
  VizPanel,
} from '@grafana/scenes';
import { Alert, Button } from '@grafana/ui';

import { logger } from '../../../services/logger';
import { fuzzySearch } from '../../../services/search';
import { BreakdownSearchReset } from './BreakdownSearchScene';
import { LayoutSwitcher } from './LayoutSwitcher';
import { VALUE_SUMMARY_PANEL_KEY } from './Panels/ValueSummary';
import { getLabelValue } from './SortByScene';
import { sortSeries } from 'services/sorting';

interface ByFrameRepeaterState extends SceneObjectState {
  body: SceneLayout;
  getLayoutChild(frame: DataFrame, frameIndex: number): SceneFlexItem;
}

type FrameFilterCallback = (frame: DataFrame) => boolean;
type FrameIterateCallback = (frames: DataFrame[], seriesIndex: number) => void;

export class ByFrameRepeater extends SceneObjectBase<ByFrameRepeaterState> {
  private unfilteredChildren: SceneFlexItem[] = [];
  private sortBy: string;
  private direction: string;
  private sortedSeries: DataFrame[] = [];
  private getFilter: () => string;
  public constructor({
    direction,
    getFilter,
    sortBy,
    ...state
  }: ByFrameRepeaterState & { direction: string; getFilter: () => string; sortBy: string }) {
    super(state);

    this.sortBy = sortBy;
    this.direction = direction;
    this.getFilter = getFilter;

    this.addActivationHandler(() => {
      const data = sceneGraph.getData(this);

      this._subs.add(
        data.subscribeToState((data, prevData) => {
          if (
            data.data?.state === LoadingState.Done ||
            (data.data?.state === LoadingState.Streaming &&
              data.data.series.length > (prevData.data?.series.length ?? 0))
          ) {
            this.performRepeat(data.data);
          }
        })
      );

      if (data.state.data) {
        this.performRepeat(data.state.data);
      }
    });
  }

  public sort = (sortBy: string, direction: string) => {
    const data = sceneGraph.getData(this);
    this.sortBy = sortBy;
    this.direction = direction;
    if (data.state.data) {
      this.performRepeat(data.state.data);
    }
  };

  private performRepeat(data: PanelData) {
    const newChildren: SceneFlexItem[] = [];
    const sortedSeries = sortSeries(data.series, this.sortBy, this.direction);

    for (let seriesIndex = 0; seriesIndex < sortedSeries.length; seriesIndex++) {
      const layoutChild = this.state.getLayoutChild(sortedSeries[seriesIndex], seriesIndex);
      newChildren.push(layoutChild);
    }

    this.sortedSeries = sortedSeries;
    this.unfilteredChildren = newChildren;

    if (this.getFilter()) {
      this.state.body.setState({ children: [] });
      this.filterByString(this.getFilter());
    } else {
      this.state.body.setState({ children: newChildren });
    }
  }

  public iterateFrames = (callback: FrameIterateCallback) => {
    const data = sceneGraph.getData(this).state.data;
    if (!data) {
      return;
    }
    for (let seriesIndex = 0; seriesIndex < this.sortedSeries.length; seriesIndex++) {
      callback(this.sortedSeries, seriesIndex);
    }
  };

  filterByString = (filter: string) => {
    let haystack: string[] = [];

    this.iterateFrames((frames, seriesIndex) => {
      const labelValue = getLabelValue(frames[seriesIndex]);
      haystack.push(labelValue);
    });
    fuzzySearch(haystack, filter, (data) => {
      if (data && data[0]) {
        // We got search results
        this.filterFrames((frame: DataFrame) => {
          const label = getLabelValue(frame);
          return data[0].includes(label);
        });
      } else {
        // reset search
        this.filterFrames(() => true);
      }

      this.filterSummaryChart(data);
    });
  };

  /**
   * Filters the summary panel rendered above the breakdown panels by adding a transformation to the panel
   * @param data
   * @private
   */
  private filterSummaryChart(data: string[][]) {
    const layoutSwitcher = sceneGraph.getAncestor(this, LayoutSwitcher);

    if (layoutSwitcher) {
      const singleGraphParent = sceneGraph.findAllObjects(
        layoutSwitcher,
        (obj) => obj.isActive && obj.state.key === VALUE_SUMMARY_PANEL_KEY
      );
      if (singleGraphParent[0] instanceof SceneFlexLayout) {
        const panel = sceneGraph.findDescendents(singleGraphParent[0], VizPanel)[0];
        if (panel instanceof VizPanel) {
          panel.setState({
            $data: new SceneDataTransformer({
              transformations: [() => limitFramesByName(data[0])],
            }),
          });
        } else {
          logger.warn('filterSummaryChart: VizPanel not found', { typeofPanel: typeof panel });
        }
      } else {
        logger.warn('filterSummaryChart: SceneFlexItem not found', { typeofGraphParent: typeof singleGraphParent });
      }
    }
  }

  public filterFrames = (filterFn: FrameFilterCallback) => {
    const newChildren: SceneFlexItem[] = [];
    this.iterateFrames((frames, seriesIndex) => {
      if (filterFn(frames[seriesIndex])) {
        newChildren.push(this.unfilteredChildren[seriesIndex]);
      }
    });

    if (newChildren.length === 0) {
      const filter = this.getFilter();
      this.state.body.setState({ children: [buildNoResultsScene(filter, this.clearFilter)] });
    } else {
      this.state.body.setState({ children: newChildren });
    }
  };

  public clearFilter = () => {
    this.publishEvent(new BreakdownSearchReset(), true);
  };

  public static Component = ({ model }: SceneComponentProps<SceneByFrameRepeater>) => {
    const { body } = model.useState();
    return <body.Component model={body} />;
  };
}

function buildNoResultsScene(filter: string, clearFilter: () => void) {
  return new SceneFlexLayout({
    children: [
      new SceneFlexItem({
        body: new SceneReactObject({
          reactNode: (
            <div className={styles.alertContainer}>
              <Alert title="" severity="info" className={styles.noResultsAlert}>
                No values found matching &ldquo;{filter}&rdquo;
                <Button className={styles.clearButton} onClick={clearFilter}>
                  Clear filter
                </Button>
              </Alert>
            </div>
          ),
        }),
      }),
    ],
    direction: 'row',
  });
}

const styles = {
  alertContainer: css({
    alignItems: 'center',
    display: 'flex',
    flexGrow: 1,
    justifyContent: 'center',
  }),
  clearButton: css({
    marginLeft: '1.5rem',
  }),
  noResultsAlert: css({
    flexGrow: 0,
    minWidth: '30vw',
  }),
};

export function limitFramesByName(matches: string[]) {
  return (source: Observable<DataFrame[]>) => {
    return source.pipe(
      map((frames) => {
        if (!matches || !matches.length) {
          return frames;
        }
        let newFrames: DataFrame[] = [];
        frames.forEach((f) => {
          const label = getLabelValue(f);
          if (matches.includes(label)) {
            newFrames.push(f);
          }
        });
        return newFrames;
      })
    );
  };
}
