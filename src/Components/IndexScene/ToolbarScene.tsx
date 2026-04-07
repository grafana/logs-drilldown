import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, sceneGraph } from '@grafana/scenes';
import { Dropdown, Icon, Switch, ToolbarButton, Tooltip, useStyles2 } from '@grafana/ui';

import pluginJson from '../../plugin.json';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { KG_INSIGHTS_DESCRIPTION } from '../../services/KgAnnotationToggle';
import { testIds } from '../../services/testIds';
import { AGGREGATED_METRIC_START_DATE } from '../ServiceSelectionScene/ServiceSelectionScene';
import { IndexScene } from './IndexScene';
import { getFeatureFlag } from 'featureFlags/openFeature';
const AGGREGATED_METRICS_USER_OVERRIDE_LOCALSTORAGE_KEY = `${pluginJson.id}.serviceSelection.aggregatedMetrics`;

export interface ToolbarSceneState extends SceneObjectState {
  isOpen: boolean;
  options: {
    aggregatedMetrics: {
      active: boolean;
      disabled: boolean;
      userOverride: boolean;
    };
  };
}
export class ToolbarScene extends SceneObjectBase<ToolbarSceneState> {
  constructor(state: Partial<ToolbarSceneState>) {
    const userOverride = localStorage.getItem(AGGREGATED_METRICS_USER_OVERRIDE_LOCALSTORAGE_KEY);
    const active = getFeatureFlag('exploreLogsAggregatedMetrics') && userOverride !== 'false';

    super({
      isOpen: false,
      options: {
        aggregatedMetrics: {
          active: active ?? false,
          disabled: false,
          userOverride: userOverride === 'true',
        },
      },
      ...state,
    });
  }

  public toggleAggregatedMetricsOverride = () => {
    const active = !this.state.options.aggregatedMetrics.active;

    reportAppInteraction(
      USER_EVENTS_PAGES.service_selection,
      USER_EVENTS_ACTIONS.service_selection.aggregated_metrics_toggled,
      {
        enabled: active,
      }
    );

    localStorage.setItem(AGGREGATED_METRICS_USER_OVERRIDE_LOCALSTORAGE_KEY, active.toString());

    this.setState({
      options: {
        aggregatedMetrics: {
          active,
          disabled: this.state.options.aggregatedMetrics.disabled,
          userOverride: active,
        },
      },
    });
  };

  public onToggleOpen = (isOpen: boolean) => {
    this.setState({ isOpen });
  };

  static Component = ({ model }: SceneComponentProps<ToolbarScene>) => {
    const { isOpen, options } = model.useState();
    const styles = useStyles2(getStyles);

    const indexScene = sceneGraph.getAncestor(model, IndexScene);
    const { kgAnnotationToggle } = indexScene.useState();
    const kgToggleState = kgAnnotationToggle?.useState();
    const exploreLogsAggregatedMetrics = getFeatureFlag('exploreLogsAggregatedMetrics');

    const renderPopover = () => {
      return (
        // This is already keyboard accessible, and removing the onClick stopPropagation will break click interactions. Telling eslint to sit down.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
        <div
          className={styles.popover}
          role="dialog"
          aria-modal="true"
          aria-label={t('Components.toolbar-scene.render-popover.aria-label-query-options', 'Query options')}
          onClick={(evt) => evt.stopPropagation()}
        >
          <div className={styles.heading}>
            <Trans i18nKey="Components.toolbar-scene.render-popover.query-options">Query options</Trans>
          </div>
          <div className={styles.options}>
            {exploreLogsAggregatedMetrics && (
              <>
                <div>
                  <Trans i18nKey="Components.toolbar-scene.aggregated-metrics">Aggregated metrics</Trans>{' '}
                  <Tooltip
                    content={
                      options.aggregatedMetrics.disabled
                        ? t(
                            'Components.toolbar-scene.aggregated-metrics-disabled-tooltip',
                            'Aggregated metrics can only be enabled for queries starting after {{date}}',
                            { date: AGGREGATED_METRIC_START_DATE.toLocaleString() }
                          )
                        : t(
                            'Components.toolbar-scene.aggregated-metrics-tooltip',
                            'Aggregated metrics will return service queries results much more quickly, but with lower resolution'
                          )
                    }
                  >
                    <Icon name="info-circle" />
                  </Tooltip>
                </div>
                <span>
                  <Switch
                    label={t(
                      'Components.toolbar-scene.render-popover.label-toggle-aggregated-metrics',
                      'Toggle aggregated metrics'
                    )}
                    data-testid={testIds.index.aggregatedMetricsToggle}
                    value={options.aggregatedMetrics.active}
                    disabled={options.aggregatedMetrics.disabled}
                    onChange={model.toggleAggregatedMetricsOverride}
                  />
                </span>
              </>
            )}
            {kgAnnotationToggle && (
              <>
                <div>
                  <Trans i18nKey="Components.toolbar-scene.insights">Insights</Trans>{' '}
                  <Tooltip content={KG_INSIGHTS_DESCRIPTION}>
                    <Icon name="info-circle" />
                  </Tooltip>
                </div>
                <span>
                  <Switch
                    label={t(
                      'Components.toolbar-scene.render-popover.label-toggle-insights-annotations',
                      'Toggle insights annotations'
                    )}
                    value={kgToggleState?.isEnabled ?? false}
                    onChange={kgAnnotationToggle.toggleEnabled}
                  />
                </span>
              </>
            )}
          </div>
        </div>
      );
    };

    if (options.aggregatedMetrics || kgAnnotationToggle) {
      return (
        <Dropdown overlay={renderPopover} placement="bottom" onVisibleChange={model.onToggleOpen}>
          <ToolbarButton
            icon="cog"
            variant="canvas"
            isOpen={isOpen}
            aria-label={t('Components.toolbar-scene.aria-label-query-options', 'Query options')}
            data-testid={testIds.index.aggregatedMetricsMenu}
          />
        </Dropdown>
      );
    }

    return <></>;
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    heading: css({
      fontWeight: theme.typography.fontWeightMedium,
      paddingBottom: theme.spacing(2),
    }),
    options: css({
      alignItems: 'center',
      columnGap: theme.spacing(2),
      display: 'grid',
      gridTemplateColumns: '1fr 50px',
      rowGap: theme.spacing(1),
    }),
    popover: css({
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      boxShadow: theme.shadows.z3,
      display: 'flex',
      flexDirection: 'column',
      marginRight: theme.spacing(2),
      padding: theme.spacing(2),
    }),
  };
}
