import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { IconButton, InlineSwitch, Label, useStyles2 } from '@grafana/ui';

import { FieldsAggregatedBreakdownScene } from './FieldsAggregatedBreakdownScene';

const errorToggleStyles = (theme: GrafanaTheme2) => {
  return {
    toggleIcon: css({
      color: theme.colors.error.main,
      marginRight: theme.spacing(1),
    }),
    toggleLabel: css({
      display: 'flex',

      marginRight: theme.spacing(2),
    }),
    toggleLabelText: css({
      marginRight: theme.spacing(1),
    }),
  };
};

export function ShowErrorPanelToggle({ model }: SceneComponentProps<FieldsAggregatedBreakdownScene>) {
  const { showErrorPanels, showErrorPanelToggle } = model.useState();
  const styles = useStyles2(errorToggleStyles);

  if (showErrorPanelToggle) {
    return (
      <Label className={styles.toggleLabel}>
        <IconButton
          className={styles.toggleIcon}
          tooltip={'One or more requests could not be processed'}
          name={'exclamation-triangle'}
          variant={'secondary'}
        />
        <span className={styles.toggleLabelText}>Show panels with errors</span>

        <InlineSwitch
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => model.toggleErrorPanels(event)}
          value={showErrorPanels}
        />
      </Label>
    );
  }

  return null;
}
