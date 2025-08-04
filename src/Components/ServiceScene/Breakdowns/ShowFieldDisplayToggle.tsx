import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { RadioButtonGroup, useStyles2 } from '@grafana/ui';

import { setFieldsPanelTypes } from '../../../services/store';
import { FieldsAggregatedBreakdownScene, FieldsPanelTypes } from './FieldsAggregatedBreakdownScene';

export function ShowFieldDisplayToggle({ model }: SceneComponentProps<FieldsAggregatedBreakdownScene>) {
  const { panelType } = model.useState();
  const styles = useStyles2(getStyles);
  const options: Array<SelectableValue<FieldsPanelTypes>> = [
    {
      label: 'Volume',
      value: 'volume',
    },
    {
      label: 'Names',
      value: 'text',
    },
  ];

  return (
    <RadioButtonGroup
      className={styles.radioGroup}
      options={options}
      value={panelType}
      onChange={(panelType) => {
        model.setState({ panelType });
        setFieldsPanelTypes(panelType);
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
