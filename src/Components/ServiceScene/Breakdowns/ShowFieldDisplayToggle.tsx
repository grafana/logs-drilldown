import React, { useCallback } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneComponentProps } from '@grafana/scenes';
import { InlineSwitch } from '@grafana/ui';

import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../../services/analytics';
import { setFieldsPanelTypes } from '../../../services/store';
import { FieldsAggregatedBreakdownScene } from './FieldsAggregatedBreakdownScene';

export function ShowFieldDisplayToggle({ model }: SceneComponentProps<FieldsAggregatedBreakdownScene>) {
  const { fieldsPanelsType } = model.useState();

  const toggle = useCallback(() => {
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

  const enabled = fieldsPanelsType === 'timeseries';

  return (
    <InlineSwitch
      label={t(
        'components.service-scene.breakdowns.show-field-display-toggle.options.label.display-volume',
        'Display volume'
      )}
      showLabel={true}
      value={enabled}
      onClick={toggle}
    />
  );
}
