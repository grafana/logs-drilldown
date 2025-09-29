import React from 'react';

import { Button } from '@grafana/ui';

import { GrotError } from 'Components/GrotError';

interface Props {
  clearFilters?: () => void;
  error: string;
  onWhereAreMyLogs?: (() => void) | null;
}

export const LogsPanelError = ({ clearFilters, error, onWhereAreMyLogs }: Props) => {
  return (
    <GrotError>
      <div>
        <p>{error}</p>
        <div className="gf-form-button-row">
          {clearFilters && (
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
          {onWhereAreMyLogs && (
            <Button variant="secondary" onClick={onWhereAreMyLogs} icon="ai-sparkle">
              Where are my logs?
            </Button>
          )}
        </div>
      </div>
    </GrotError>
  );
};
