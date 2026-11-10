import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { EfficiencyDetails } from './EfficiencyDetails';
import { buildEfficiencyGaugePanel } from './gaugePanel';
import { EfficiencyScoreData, getPlaceholderEfficiencyData } from './scoring';

export interface EmbeddedQueryEfficiencySceneOptions {
  query: string;
}

export interface EmbeddedQueryEfficiencySceneState extends SceneObjectState {
  data: EfficiencyScoreData;
  expanded: boolean;
  gauge: VizPanel;
  query: string;
}

// Built from scratch: does not reuse IndexScene/ServiceScene or any other existing scene.
// `data` is a hardcoded placeholder today; a follow-up wires it to real Loki-stats-based scoring for `query`.
export class EmbeddedQueryEfficiencyScene extends SceneObjectBase<EmbeddedQueryEfficiencySceneState> {
  public constructor({ query }: EmbeddedQueryEfficiencySceneOptions) {
    const data = getPlaceholderEfficiencyData();
    super({
      data,
      expanded: false,
      gauge: buildEfficiencyGaugePanel(data.score),
      query,
    });
  }

  public toggleExpanded = () => {
    this.setState({ expanded: !this.state.expanded });
  };

  public static Component = ({ model }: SceneComponentProps<EmbeddedQueryEfficiencyScene>) => {
    const { data, expanded, gauge, query } = model.useState();
    const styles = useStyles2(getStyles);

    const onKeyDown = (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        model.toggleExpanded();
      }
    };

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
