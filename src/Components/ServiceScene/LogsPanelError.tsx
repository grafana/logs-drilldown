import React, { useEffect, useState } from 'react';

import { isAssistantAvailable, openAssistant } from '@grafana/assistant';
import { Button, Stack } from '@grafana/ui';

import { GrotError } from 'Components/GrotError';

interface Props {
  clearFilters?: () => void;
  error: string;
  errorType?: ErrorType;
}

export type ErrorType = 'no-logs' | 'other';

export const LogsPanelError = ({ clearFilters, error, errorType }: Props) => {
  const [assistantAvailable, setAssitantAvailable] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    if (errorType !== 'no-logs') {
      return;
    }
    isAssistantAvailable().subscribe((isAvailable: boolean) => {
      setAssitantAvailable(isAvailable);
    });
  }, [errorType]);

  return (
    <GrotError>
      <div>
        <p>{error}</p>
        <Stack justifyContent="center">
          {clearFilters && (
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
          {errorType === 'no-logs' && assistantAvailable && (
            <Button variant="secondary" onClick={solveWithAssistant} icon="ai-sparkle">
              Ask Grafana Assistant
            </Button>
          )}
        </Stack>
      </div>
    </GrotError>
  );
};

function solveWithAssistant() {
  openAssistant({
    origin: 'logs-drilldown-empty-results',
    prompt: 'Investigate why there are no logs to display with the current filters and time range.',
  });
}
