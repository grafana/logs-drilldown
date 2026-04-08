import React from 'react';

import { t, Trans } from '@grafana/i18n';
import { Button } from '@grafana/ui';

import { IndexScene } from './IndexScene';

type Props = {
  indexScene: IndexScene;
};

export function ResetFiltersButton({ indexScene }: Props) {
  const { currentFiltersMatchReference } = indexScene.useState();

  return (
    !currentFiltersMatchReference && (
      <Button
        icon="repeat"
        variant="secondary"
        onClick={() => indexScene.resetToReferenceQuery()}
        tooltip={t(
          'components.reset-filters-button.tooltip-reset-label-filters-to-initial-values',
          'Reset label filters to initial values.'
        )}
      >
        <Trans i18nKey="components.reset-filters-button.reset">Reset</Trans>
      </Button>
    )
  );
}
