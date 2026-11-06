import React from 'react';

import { isEqual } from 'lodash';
import { EMPTY, Subject, switchMap } from 'rxjs';

import { formattedValueToString, getValueFormat, TimeRange } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import {
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  VariableDependencyConfig,
} from '@grafana/scenes';
import { Text, Tooltip } from '@grafana/ui';

import { LokiQuery, LokiQueryStats } from 'services/lokiQuery';
import { interpolateExpression } from 'services/query';
import { getDataSource, getLokiDatasource } from 'services/scenes';
import { testIds } from 'services/testIds';
import { VAR_DATASOURCE } from 'services/variables';

interface QueryStatsParams {
  datasourceUid: string;
  query: LokiQuery;
  timeRange: TimeRange;
}

interface QueryStatsSceneState extends SceneObjectState {
  inputs?: QueryStatsParams;
  loading: boolean;
  stats?: LokiQueryStats;
}

export class QueryStatsScene extends SceneObjectBase<QueryStatsSceneState> {
  private previousParams?: QueryStatsParams;
  private requests = new Subject<QueryStatsParams | undefined>();

  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_DATASOURCE],
    onVariableUpdateCompleted: () => this.updateQueryStats(),
  });

  constructor() {
    super({ loading: true });
    this.addActivationHandler(() => this.onActivate());
  }

  private onActivate() {
    const runner = sceneGraph.getData(this);
    if (!(runner instanceof SceneQueryRunner)) {
      return;
    }
    this.previousParams = undefined;
    this._subs.add(
      this.requests
        .pipe(switchMap((inputs) => (inputs ? this.fetchStats(inputs) : EMPTY)))
        .subscribe((stats) => this.setState({ loading: false, stats }))
    );

    this._subs.add(
      runner.subscribeToState((state, previous) => {
        if (state.queries !== previous.queries) {
          this.updateQueryStats();
        }
      })
    );
    this._subs.add(sceneGraph.getTimeRange(this).subscribeToState(this.updateQueryStats));
    this.updateQueryStats();
  }

  private updateQueryStats = () => {
    if (!this.isActive) {
      return;
    }
    const runner = sceneGraph.getData(this);
    if (!(runner instanceof SceneQueryRunner)) {
      return;
    }
    this._variableDependency.setVariableNames([VAR_DATASOURCE, ...(runner.variableDependency?.getNames() ?? [])]);
    const query = runner.state.queries[0];
    const inputs: QueryStatsParams | undefined = query
      ? {
          datasourceUid: getDataSource(runner),
          query: {
            ...query,
            datasource: query.datasource ?? undefined,
            expr: interpolateExpression(runner, query.expr).trim(),
          },
          timeRange: sceneGraph.getTimeRange(runner).state.value,
        }
      : undefined;
    if (isEqual(inputs, this.previousParams)) {
      return;
    }
    this.previousParams = inputs;
    this.setState({ inputs, loading: Boolean(inputs), stats: undefined });
    if (this._variableDependency.hasDependencyInLoadingState()) {
      this.previousParams = undefined;
      this.requests.next(undefined);
    } else {
      this.requests.next(inputs);
    }
  };

  private async fetchStats({ query, timeRange }: QueryStatsParams): Promise<LokiQueryStats | undefined> {
    try {
      const datasource = await getLokiDatasource(this);
      const result = await datasource?.getStats?.({ ...query, refId: `query-size-${this.state.key}` }, timeRange);
      return result && (result.message || (Number.isFinite(result.bytes) && result.bytes > 0)) ? result : undefined;
    } catch {
      // Estimation failures must not prevent logs from loading.
      return undefined;
    }
  }

  static Component = ({ model }: SceneComponentProps<QueryStatsScene>) => {
    const { inputs, loading, stats } = model.useState();
    if (!inputs) {
      return null;
    }
    const size = stats ? formattedValueToString(getValueFormat('bytes')(stats.bytes, 1)) : '';

    return (
      <Tooltip
        content={t(
          'components.query-stats.scope',
          'Estimate for the logs query and selected time range, based on indexed labels. Pipeline filters and data still in ingesters are not included.'
        )}
      >
        <Text element="span" color="secondary" variant="sm">
          <span data-testid={testIds.exploreServiceDetails.querySizeEstimate}>
            {loading ? (
              <Trans i18nKey="components.query-stats.loading">Estimating query size…</Trans>
            ) : stats?.message ? (
              stats.message
            ) : stats ? (
              <Trans i18nKey="components.query-stats.estimate" values={{ size }}>
                This query processes approximately {'{{size}}'}
              </Trans>
            ) : (
              <Trans i18nKey="components.query-stats.unavailable">Query size estimate unavailable</Trans>
            )}
          </span>
        </Text>
      </Tooltip>
    );
  };
}
