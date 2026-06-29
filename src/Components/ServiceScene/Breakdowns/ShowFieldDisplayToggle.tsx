import React, { useCallback, useState } from 'react';

import { t } from '@grafana/i18n';
import { SceneComponentProps } from '@grafana/scenes';
import { Stack, Switch, Tooltip } from '@grafana/ui';

import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../../services/analytics';
import { setFieldsPanelTypes } from '../../../services/store';
import { FieldsAggregatedBreakdownScene } from './FieldsAggregatedBreakdownScene';
import { setParserEnabled, getParserEnabled } from 'services/parserToggle';

export function ShowFieldDisplayToggle({ model }: SceneComponentProps<FieldsAggregatedBreakdownScene>) {
  const { fieldsPanelsType } = model.useState();
  const [parsersEnabledState, setParserEnabledState] = useState(getParserEnabled());

  const toggleVolume = useCallback(() => {
    const nextPanelType = fieldsPanelsType === 'timeseries' ? 'text' : 'timeseries';
    model.setState({ fieldsPanelsType: nextPanelType });
    setFieldsPanelTypes(nextPanelType);
    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.fields_panel_type_toggle,
      {
        fieldsPanelType: nextPanelType,
      }
    );
  }, [fieldsPanelsType, model]);

  const toggleParser = useCallback(() => {
    const parsersEnabled = !parsersEnabledState;

    reportAppInteraction(USER_EVENTS_PAGES.all, USER_EVENTS_ACTIONS.all.parsers_toggled, {
      enabled: parsersEnabled,
    });

    setParserEnabled(parsersEnabled, model);

    setParserEnabledState(parsersEnabled);
  }, [model, parsersEnabledState]);

  const volumeEnabled = fieldsPanelsType === 'timeseries';

  return (
    <Stack gap={2} flex={1}>
      <Stack alignItems="center">
        <Tooltip
          content={t(
            'components.service-scene.breakdowns.show-field-display-toggle.options.tooltip.display-volume',
            'Query time series for each field showing the distribution of values over time'
          )}
        >
          <label htmlFor="toggle-volume">
            {t(
              'components.service-scene.breakdowns.show-field-display-toggle.options.label.display-volume',
              'Display volume'
            )}
          </label>
        </Tooltip>
        <Switch value={volumeEnabled} onChange={toggleVolume} id="toggle-volume" />
      </Stack>

      <Stack alignItems="center">
        <Tooltip
          content={t(
            'components.service-scene.breakdowns.show-field-display-toggle.options.tooltip.parse-fields',
            'Enable to apply logfmt/JSON parsers to every query and extract fields from the log lines'
          )}
        >
          <label htmlFor="toggle-parser">
            {t(
              'components.service-scene.breakdowns.show-field-display-toggle.options.label.parse-fields',
              'Extract fields'
            )}
          </label>
        </Tooltip>
        <Switch value={parsersEnabledState} onChange={toggleParser} id="toggle-parser" />
      </Stack>
    </Stack>
  );
}
