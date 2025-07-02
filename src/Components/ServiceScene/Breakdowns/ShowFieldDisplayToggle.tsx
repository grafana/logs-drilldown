import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { RadioButtonGroup, useStyles2 } from '@grafana/ui';

import { FieldsAggregatedBreakdownScene, FieldsPanelTypes } from './FieldsAggregatedBreakdownScene';

export function ShowFieldDisplayToggle({ model }: SceneComponentProps<FieldsAggregatedBreakdownScene>) {
  const { panelType } = model.useState();
  const styles = useStyles2(getStyles);
  const options: Array<SelectableValue<FieldsPanelTypes>> = [
    {
      label: 'Volume',
      value: 'volume',
    },
    // This field is confusing, 100 means it's on 100% of the samples
    {
      label: 'Sampled cardinality',
      value: 'cardinality_estimated',
    },
    {
      label: 'Cardinality',
      value: 'cardinality',
    },
  ];

  return (
    <RadioButtonGroup
      className={styles.radioGroup}
      options={options}
      value={panelType}
      onChange={(panelType) => model.setState({ panelType })}
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
