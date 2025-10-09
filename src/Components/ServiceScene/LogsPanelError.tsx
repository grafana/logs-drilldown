import React, { useEffect, useState } from 'react';

import { isAssistantAvailable, openAssistant } from '@grafana/assistant';
import { SceneObject } from '@grafana/scenes';
import { Button, Stack } from '@grafana/ui';

import { GrotError } from 'Components/GrotError';
import { getEmptyStateOptions } from 'services/extensions/embedding';

interface Props {
  clearFilters?: () => void;
  error: string;
  errorType?: ErrorType;
  sceneRef: SceneObject;
}

export type ErrorType = 'no-logs' | 'other';

export const LogsPanelError = ({ clearFilters, error, errorType, sceneRef }: Props) => {
  const [assistantAvailable, setAssistantAvailable] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (errorType !== 'no-logs') {
      return;
    }
    isAssistantAvailable().subscribe((isAvailable: boolean) => {
      setAssistantAvailable(isAvailable);
    });
  }, [errorType]);

  const embeddedOptions = getEmptyStateOptions('logs', sceneRef);

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
            <Button
              variant="secondary"
              onClick={() => solveWithAssistant(embeddedOptions?.customPrompt)}
              icon="ai-sparkle"
            >
              {embeddedOptions?.promptCTA ?? 'Ask Grafana Assistant'}
            </Button>
          )}
        </Stack>
      </div>
    </GrotError>
  );
};

function solveWithAssistant(
  prompt = 'Investigate why there are no logs to display with the current filters and time range.'
) {
  openAssistant({
    origin: 'logs-drilldown-empty-results',
    prompt,
  });
}
