import React, { useCallback } from 'react';

import { t } from '@grafana/i18n';
import { SceneComponentProps } from '@grafana/scenes';
import { Stack, Switch, Tooltip } from '@grafana/ui';

import { LabelsAggregatedBreakdownScene } from './LabelsAggregatedBreakdownScene';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { setLabelsPanelType } from 'services/store';

export function ShowLabelDisplayToggle({ model }: SceneComponentProps<LabelsAggregatedBreakdownScene>) {
  const { labelsPanelsType } = model.useState();

  const toggleVolume = useCallback(() => {
    const nextPanelType = labelsPanelsType === 'timeseries' ? 'text' : 'timeseries';
    model.setState({ labelsPanelsType: nextPanelType });
    setLabelsPanelType(nextPanelType);
    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.labels_panel_type_toggle,
      {
        labelsPanelType: nextPanelType,
      }
    );
  }, [labelsPanelsType, model]);

  const volumeEnabled = labelsPanelsType === 'timeseries';

  return (
    <Stack gap={2} flex={1}>
      <Stack alignItems="center">
        <Tooltip
          content={t(
            'components.service-scene.breakdowns.show-label-display-toggle.options.tooltip.display-volume',
            'Query time series for each label showing the distribution of values over time'
          )}
        >
          <label htmlFor="toggle-label-volume">
            {t(
              'components.service-scene.breakdowns.show-label-display-toggle.options.label.display-volume',
              'Display volume'
            )}
          </label>
        </Tooltip>
        <Switch value={volumeEnabled} onChange={toggleVolume} id="toggle-label-volume" />
      </Stack>
    </Stack>
  );
}
