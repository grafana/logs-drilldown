import React from 'react';

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
        tooltip="Reset filters to initial values."
      >
        Reset
      </Button>
    )
  );
}
