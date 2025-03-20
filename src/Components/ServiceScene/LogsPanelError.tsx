import React from 'react';
import { GrotError } from 'Components/GrotError';
import { Button } from '@grafana/ui';

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
