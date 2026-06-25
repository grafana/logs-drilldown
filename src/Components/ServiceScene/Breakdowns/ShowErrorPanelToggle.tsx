import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneComponentProps } from '@grafana/scenes';
import { IconButton, InlineSwitch, Stack, useStyles2 } from '@grafana/ui';

import { FieldsAggregatedBreakdownScene } from './FieldsAggregatedBreakdownScene';

const errorToggleStyles = (theme: GrafanaTheme2) => {
  return {
    toggleIcon: css({
      color: theme.colors.error.main,
    }),
  };
};

export function ShowErrorPanelToggle({ model }: SceneComponentProps<FieldsAggregatedBreakdownScene>) {
  const { showErrorPanels, showErrorPanelToggle } = model.useState();
  const styles = useStyles2(errorToggleStyles);

  if (showErrorPanelToggle) {
    return (
      <Stack alignItems="center" gap={0}>
        <IconButton
          className={styles.toggleIcon}
          tooltip={t(
            'components.service-scene.breakdowns.show-error-panel-toggle.tooltip-requests-could-processed',
            'One or more requests could not be processed'
          )}
          name={'exclamation-triangle'}
          variant={'secondary'}
        />

        <InlineSwitch
          label={t(
            'components.service-scene.breakdowns.show-error-panel-toggle.show-panels-with-errors',
            'Show panels with errors'
          )}
          showLabel
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => model.toggleErrorPanels(event)}
          value={showErrorPanels}
          transparent
        />
      </Stack>
    );
  }

  return null;
}
