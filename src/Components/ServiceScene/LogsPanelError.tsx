import React from 'react';

import { Button } from '@grafana/ui';

import { GrotError } from 'Components/GrotError';

interface Props {
  clearFilters(): void;
  error: string;
}

export const LogsPanelError = ({ clearFilters, error }: Props) => {
  return (
    <GrotError>
      <div>
        <p>{error}</p>
        <Button variant="secondary" onClick={clearFilters}>
          Clear filters
        </Button>
      </div>
    </GrotError>
  );
};
