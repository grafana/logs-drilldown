import React, { useEffect, useState } from 'react';

import { css } from '@emotion/css';

import { isAssistantAvailable, openAssistant } from '@grafana/assistant';
import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneObject } from '@grafana/scenes';
import { Button, EmptyState, Stack, useStyles2 } from '@grafana/ui';

import { getEmptyStateOptions } from 'services/extensions/embedding';

interface Props {
  clearFilters?: () => void;
  error: string;
  errorType?: ErrorType;
  sceneRef: SceneObject;
}

export type ErrorType = 'no-logs' | 'other';

export const LogsPanelError = ({ clearFilters, error, errorType, sceneRef }: Props) => {
  const styles = useStyles2(getStyles);
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
  const message = error || t('logs.logs-drilldown.logs-panel-error.default', 'An error occurred');

  return (
    <div className={styles.wrap}>
      <EmptyState variant="not-found" message={message}>
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

function getStyles(theme: GrafanaTheme2) {
  return {
    wrap: css({
      width: '100%',
      minHeight: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      padding: theme.spacing(2),
    }),
  };
}
