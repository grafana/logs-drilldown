import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { Alert, LoadingPlaceholder, useStyles2 } from '@grafana/ui';

import { EfficiencyDetails } from './EfficiencyDetails';
import { buildEfficiencyGaugePanel } from './gaugePanel';
import { computeEfficiencyScore, EfficiencyScoreData } from './scoring';
import { fetchIndexStats } from './statsApi';

export interface EmbeddedQueryEfficiencySceneOptions {
  datasourceUid: string;
  query: string;
  timeRange: TimeRange;
}

export interface EmbeddedQueryEfficiencySceneState extends SceneObjectState {
  data?: EfficiencyScoreData;
  datasourceUid: string;
  error?: string;
  expanded: boolean;
  gauge: VizPanel;
  isLoading: boolean;
  query: string;
  timeRange: TimeRange;
}

// Built from scratch: does not reuse IndexScene/ServiceScene or any other existing scene.
export class EmbeddedQueryEfficiencyScene extends SceneObjectBase<EmbeddedQueryEfficiencySceneState> {
  public constructor({ datasourceUid, query, timeRange }: EmbeddedQueryEfficiencySceneOptions) {
    super({
      datasourceUid,
      expanded: false,
      gauge: buildEfficiencyGaugePanel(0, ''),
      isLoading: true,
      query,
      timeRange,
    });

    this.addActivationHandler(() => {
      this.fetchStats();
    });
  }

  private async fetchStats() {
    const { datasourceUid, query, timeRange } = this.state;
    this.setState({ error: undefined, isLoading: true });

    try {
      const stats = await fetchIndexStats(datasourceUid, query, timeRange);
      const data = computeEfficiencyScore(stats, query);
      this.setState({ data, gauge: buildEfficiencyGaugePanel(data.score, data.summary), isLoading: false });
    } catch (e) {
      this.setState({
        error: e instanceof Error ? e.message : 'Failed to fetch query stats',
        isLoading: false,
      });
    }
  }

  public toggleExpanded = () => {
    this.setState({ expanded: !this.state.expanded });
  };

  public static Component = ({ model }: SceneComponentProps<EmbeddedQueryEfficiencyScene>) => {
    const { data, error, expanded, gauge, isLoading, query } = model.useState();
    const styles = useStyles2(getStyles);

    const onKeyDown = (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        model.toggleExpanded();
      }
    };

    if (isLoading) {
      return (
        <LoadingPlaceholder
          text={t('components.embedded-query-efficiency.embedded-query-efficiency-scene.loading', 'Calculating...')}
        />
      );
    }

    if (error) {
      return (
        <Alert
          severity="error"
          title={t(
            'components.embedded-query-efficiency.embedded-query-efficiency-scene.error-title',
            'Could not fetch query stats'
          )}
        >
          {error}
        </Alert>
      );
    }

    if (!data) {
      return null;
    }

    return (
      <div>
        <div
          aria-expanded={expanded}
          className={styles.gaugeWrapper}
          onClick={model.toggleExpanded}
          onKeyDown={onKeyDown}
          role="button"
          tabIndex={0}
        >
          <gauge.Component model={gauge} />
        </div>
        <div className={styles.hint}>
          {expanded
            ? t(
                'components.embedded-query-efficiency.embedded-query-efficiency-scene.hide-details',
                'Click to hide details'
              )
            : t(
                'components.embedded-query-efficiency.embedded-query-efficiency-scene.show-details',
                'Click for details'
              )}
        </div>
        {expanded && <EfficiencyDetails checks={data.checks} query={query} />}
      </div>
    );
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  gaugeWrapper: css({
    cursor: 'pointer',
    height: '140px',
    width: '180px',
  }),
  hint: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
