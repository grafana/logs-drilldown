import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneComponentProps } from '@grafana/scenes';
import { RadioButtonGroup, useStyles2 } from '@grafana/ui';

import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../../services/analytics';
import { setFieldsPanelTypes } from '../../../services/store';
import { FieldsAggregatedBreakdownScene, FieldsPanelsType } from './FieldsAggregatedBreakdownScene';

export function ShowFieldDisplayToggle({ model }: SceneComponentProps<FieldsAggregatedBreakdownScene>) {
  const { fieldsPanelsType } = model.useState();
  const styles = useStyles2(getStyles);
  const options: Array<SelectableValue<FieldsPanelsType>> = [
    {
      label: t('components.show-field-display-toggle.options.label.volume', 'Volume'),
      value: 'timeseries',
    },
    {
      label: t('components.show-field-display-toggle.options.label.names', 'Names'),
      value: 'text',
    },
  ];

  return (
    <RadioButtonGroup
      className={styles.radioGroup}
      options={options}
      value={fieldsPanelsType}
      onChange={(panelType) => {
        model.setState({ fieldsPanelsType: panelType });
        setFieldsPanelTypes(panelType);
        reportAppInteraction(
          USER_EVENTS_PAGES.service_details,
          USER_EVENTS_ACTIONS.service_details.fields_panel_type_toggle,
          {
            fieldsPanelType: panelType,
          }
        );
      }}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    radioGroup: css({
      [theme.breakpoints.up(theme.breakpoints.values.md)]: {
        flexDirection: 'row',
      },
      // Why do I need to hack the label height?
      '> div > label': {
        height: '100%',
      },

      flexDirection: 'column',
    }),
  };
};
