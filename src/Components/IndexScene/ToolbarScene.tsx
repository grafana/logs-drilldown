import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Dropdown, Switch, ToolbarButton, useStyles2 } from '@grafana/ui';

import pluginJson from '../../plugin.json';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { testIds } from '../../services/testIds';
import { AGGREGATED_METRIC_START_DATE } from '../ServiceSelectionScene/ServiceSelectionScene';
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
    const active = config.featureToggles.exploreLogsAggregatedMetrics && userOverride !== 'false';

    super({
      isOpen: false,
      options: {
        aggregatedMetrics: {
          active: active ?? false,
          disabled: false,
          userOverride: userOverride === 'true' ?? false,
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

    const renderPopover = () => {
      return (
        // This is already keyboard accessible, and removing the onClick stopPropagation will break click interactions. Telling eslint to sit down.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
        <div
          className={styles.popover}
          role="dialog"
          aria-modal="true"
          aria-label="Query options"
          onClick={(evt) => evt.stopPropagation()}
        >
          <div className={styles.heading}>Query options</div>
          <div className={styles.options}>
            <div
              title={
                'Aggregated metrics will return service queries results much more quickly, but with lower resolution'
              }
            >
              Aggregated metrics
            </div>
            <span
              title={
                options.aggregatedMetrics.disabled
                  ? `Aggregated metrics can only be enabled for queries starting after ${AGGREGATED_METRIC_START_DATE.toLocaleString()}`
                  : ''
              }
            >
              <Switch
                label={'Toggle aggregated metrics'}
                data-testid={testIds.index.aggregatedMetricsToggle}
                value={options.aggregatedMetrics.active}
                disabled={options.aggregatedMetrics.disabled}
                onChange={model.toggleAggregatedMetricsOverride}
              />
            </span>
          </div>
        </div>
      );
    };

    if (options.aggregatedMetrics) {
      return (
        <Dropdown overlay={renderPopover} placement="bottom" onVisibleChange={model.onToggleOpen}>
          <ToolbarButton
            icon="cog"
            variant="canvas"
            isOpen={isOpen}
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
