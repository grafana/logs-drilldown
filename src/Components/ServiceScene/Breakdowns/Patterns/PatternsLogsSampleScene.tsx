import React from 'react';

import { LoadingState } from '@grafana/data';
import {
  PanelBuilders,
  SceneComponentProps,
  SceneDataProviderResult,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneReactObject,
  VizPanel,
} from '@grafana/scenes';
import { Alert, Button } from '@grafana/ui';

import { logger } from '../../../../services/logger';
import { LokiQuery } from '../../../../services/lokiQuery';
import { getQueryRunner } from '../../../../services/panel';
import { buildDataQuery } from '../../../../services/query';
import { renderPatternFilters } from '../../../../services/renderPatternFilters';
import { getFieldsVariable, getLevelsVariable, getLineFiltersVariable } from '../../../../services/variableGetters';
import {
  AppliedPattern,
  LOG_STREAM_SELECTOR_EXPR,
  PATTERNS_SAMPLE_SELECTOR_EXPR,
  VAR_PATTERNS_EXPR,
} from '../../../../services/variables';
import { emptyStateStyles } from '../FieldsBreakdownScene';
import { PatternsViewTableScene } from './PatternsViewTableScene';
import { LOG_OPTIONS_PATTERNS_LOCALSTORAGE_KEY } from 'services/store';

interface PatternsLogsSampleSceneState extends SceneObjectState {
  body?: SceneFlexLayout;
  pattern: string;
}
export class PatternsLogsSampleScene extends SceneObjectBase<PatternsLogsSampleSceneState> {
  constructor(state: PatternsLogsSampleSceneState) {
    super(state);

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    if (this.state.body) {
      return;
    }

    // We start by querying with the users current query context
    const queryWithFilters = buildDataQuery(LOG_STREAM_SELECTOR_EXPR);
    this.replacePatternsInQuery(queryWithFilters);

    // but if that fails to return results, we fire the query without the filters, instead of showing no-data in the viz
    const queryRunnerWithFilters = getQueryRunner([queryWithFilters]);
    queryRunnerWithFilters.getResultsStream().subscribe((value) => {
      this.onQueryWithFiltersResult(value);
    });

    this.setState({
      body: new SceneFlexLayout({
        children: [
          new SceneFlexItem({
            body: undefined,
            height: 0,
            width: '100%',
          }),
          new SceneFlexItem({
            body: PanelBuilders.logs()
              .setHoverHeader(true)
              .setOption('showLogContextToggle', true)
              .setOption('showTime', true)
              // @ts-expect-error Requires Grafana 12.2
              .setOption('noInteractions', true)
              .setOption('controlsStorageKey', LOG_OPTIONS_PATTERNS_LOCALSTORAGE_KEY)
              .setData(queryRunnerWithFilters)
              .build(),
            height: 300,
            width: '100%',
          }),
        ],
        direction: 'column',
      }),
    });
  }

  private replacePatternsInQuery(queryWithFilters: LokiQuery) {
    const pendingPattern: AppliedPattern = {
      pattern: this.state.pattern,
      type: 'include',
    };
    const patternsLine = renderPatternFilters([pendingPattern]);
    queryWithFilters.expr = queryWithFilters.expr.replace(VAR_PATTERNS_EXPR, patternsLine);
  }

  private clearFilters = () => {
    const filterVariable = getFieldsVariable(this);
    const lineFiltersVariable = getLineFiltersVariable(this);
    const levelsVariable = getLevelsVariable(this);
    filterVariable.setState({
      filters: [],
    });
    levelsVariable.setState({
      filters: [],
    });
    if (lineFiltersVariable.state.filters.length) {
      lineFiltersVariable.setState({
        filters: [],
      });

      const noticeFlexItem = this.getNoticeFlexItem();

      // The query we just fired is already correct after we clear the filters, we just need to hide the warning, and allow filtering
      noticeFlexItem?.setState({
        isHidden: true,
      });

      this.removePatternFromFilterExclusion();
    }
  };

  private removePatternFromFilterExclusion() {
    const patternsViewTableScene = sceneGraph.getAncestor(this, PatternsViewTableScene);
    const patternsNotMatchingFilters = patternsViewTableScene.state.patternsNotMatchingFilters ?? [];

    const index = patternsNotMatchingFilters.findIndex((pattern) => pattern === this.state.pattern);

    if (index !== -1) {
      patternsNotMatchingFilters.splice(index, 1);
      // remove this pattern, as they can filter by this pattern again
      patternsViewTableScene.setState({
        patternsNotMatchingFilters: patternsNotMatchingFilters,
      });
    }
  }

  /**
   * If the first query with the users filters applied fails, we run another one after removing the filters
   * @param value
   */
  private onQueryError = (value: SceneDataProviderResult) => {
    if (
      (value.data.state === LoadingState.Done &&
        (value.data.series.length === 0 || value.data.series.every((frame) => frame.length === 0))) ||
      value.data.state === LoadingState.Error
    ) {
      // Logging an error so loki folks can debug why some patterns returned from the API seem to fail.
      let logContext;
      try {
        logContext = {
          msg: 'onQueryError',
          pattern: this.state.pattern,
          request: JSON.stringify(value.data.request),
          traceIds: JSON.stringify(value.data.traceIds),
        };
      } catch (e) {
        logContext = {
          msg: 'Failed to encode context',
          pattern: this.state.pattern,
        };
      }

      // Logging an error so loki folks can debug why some patterns returned from the API seem to fail.
      logger.error(new Error('Pattern sample query returns no results'), logContext);

      this.setWarningMessage(
        <Alert severity={'error'} title={''}>
          This pattern returns no logs.
        </Alert>
      );

      const panelFlexItem = this.getVizFlexItem();

      // Run another query without the filters so we can still show log lines of what the pattern looks like.
      if (panelFlexItem instanceof SceneFlexItem) {
        panelFlexItem.setState({
          isHidden: true,
        });
      }
    }
  };

  private setWarningMessage(reactNode: React.ReactNode) {
    const noticeFlexItem = this.getNoticeFlexItem();
    const vizFlexItem = this.getVizFlexItem();

    if (noticeFlexItem instanceof SceneFlexItem) {
      noticeFlexItem.setState({
        body: new SceneReactObject({
          reactNode: reactNode,
        }),
        height: 'auto',
        isHidden: false,
      });
    }
    return vizFlexItem;
  }

  private getNoticeFlexItem() {
    const children = this.getFlexItemChildren();
    return children?.[0];
  }
  private getVizFlexItem() {
    const children = this.getFlexItemChildren();
    return children?.[1];
  }

  private getFlexItemChildren() {
    return this.state.body?.state.children;
  }

  /**
   * Callback to subscription of pattern sample query with all of the current query filters applied.
   * If this query fails to return data, we show a warning, and attempt the pattern sample query again without applying the existing filters.
   * We also add the pattern to the state of the PatternsTableViewScene so we can hide the filter buttons for this pattern, as including it would break the query
   * @param value
   */
  private onQueryWithFiltersResult = (value: SceneDataProviderResult) => {
    const queryWithoutFilters = buildDataQuery(PATTERNS_SAMPLE_SELECTOR_EXPR);
    this.replacePatternsInQuery(queryWithoutFilters);

    const queryRunnerWithoutFilters = getQueryRunner([queryWithoutFilters]);

    // Subscribe to the secondary query, so we can log errors and update the UI
    queryRunnerWithoutFilters.getResultsStream().subscribe(this.onQueryError);

    if (
      value.data.state === LoadingState.Done &&
      (value.data.series.length === 0 || value.data.series.every((frame) => frame.length === 0))
    ) {
      const noticeFlexItem = this.getNoticeFlexItem();
      const panelFlexItem = this.getVizFlexItem();

      // Add a warning notice that the patterns shown will not show up in their current log results due to their existing filters.
      if (noticeFlexItem instanceof SceneFlexItem) {
        noticeFlexItem.setState({
          body: new SceneReactObject({
            reactNode: (
              <Alert severity={'warning'} title={''}>
                The logs returned by this pattern do not match the current query filters.
                <Button className={emptyStateStyles.button} onClick={() => this.clearFilters()}>
                  Clear filters
                </Button>
              </Alert>
            ),
          }),
          height: 'auto',
          isHidden: false,
        });
      }

      // Run another query without the filters so we can still show log lines of what the pattern looks like.
      if (panelFlexItem instanceof SceneFlexItem) {
        const panel = panelFlexItem.state.body;
        if (panel instanceof VizPanel) {
          panel?.setState({
            $data: queryRunnerWithoutFilters,
          });
        }
      }
      this.excludeThisPatternFromFiltering();
    }

    if (value.data.state === LoadingState.Error) {
      this.onQueryError(value);
    }
  };

  private excludeThisPatternFromFiltering() {
    const patternsViewTableScene = sceneGraph.getAncestor(this, PatternsViewTableScene);
    const patternsThatDontMatchCurrentFilters = patternsViewTableScene.state.patternsNotMatchingFilters ?? [];

    // Add this pattern to the array of patterns that don't match current filters
    patternsViewTableScene.setState({
      patternsNotMatchingFilters: [...patternsThatDontMatchCurrentFilters, this.state.pattern],
    });
  }

  public static Component({ model }: SceneComponentProps<PatternsLogsSampleScene>) {
    const { body } = model.useState();
    if (body) {
      return <body.Component model={body} />;
    }
    return null;
  }
}
