import React, { useEffect, useState } from 'react';

import { isAssistantAvailable, openAssistant } from '@grafana/assistant';
import { t } from '@grafana/i18n';
import { SceneObject } from '@grafana/scenes';
import { Button, EmptyState, Stack } from '@grafana/ui';

import { getEmptyStateOptions } from 'services/extensions/embedding';
import { useSharedStyles } from 'styles/shared-styles';

interface Props {
  clearFilters?: () => void;
  error: string;
  errorType?: ErrorType;
  sceneRef: SceneObject;
}

export type ErrorType = 'no-logs' | 'other';

export const LogsPanelError = ({ clearFilters, error, errorType, sceneRef }: Props) => {
  const sharedStyles = useSharedStyles();
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
  const message = error || t('components.service-scene.logs-panel-error.default', 'An error occurred');

  return (
    <div className={sharedStyles.emptyStateWrap}>
      <EmptyState variant="not-found" message={message}>
        <Stack justifyContent="center">
          {clearFilters && (
            <Button variant="secondary" onClick={clearFilters}>
              {t('components.service-scene.logs-panel-error.clear-filters', 'Clear filters')}
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
      </EmptyState>
    </div>
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
