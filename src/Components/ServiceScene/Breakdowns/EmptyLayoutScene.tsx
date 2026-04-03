import React, { useEffect, useState } from 'react';

import { isAssistantAvailable, openAssistant } from '@grafana/assistant';
import { t } from '@grafana/i18n';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Box, Button, EmptyState } from '@grafana/ui';

import { emptyStateStyles } from './FieldsBreakdownScene';
import { getEmptyStateOptions } from 'services/extensions/embedding';

export interface EmptyLayoutSceneState extends SceneObjectState {
  type: 'fields' | 'labels';
}

export class EmptyLayoutScene extends SceneObjectBase<EmptyLayoutSceneState> {
  public static Component = EmptyLayoutComponent;
}

function EmptyLayoutComponent({ model }: SceneComponentProps<EmptyLayoutScene>) {
  const [assistantAvailable, setAssistantAvailable] = useState<boolean | undefined>(undefined);
  const { type } = model.useState();

  useEffect(() => {
    const sub = isAssistantAvailable().subscribe((isAvailable: boolean) => {
      setAssistantAvailable(isAvailable);
    });
    return () => sub.unsubscribe();
  }, []);

  const embeddedOptions = getEmptyStateOptions(type, model);

  return (
    <EmptyState
      variant="not-found"
      message={t('logs.logs-drilldown.empty-layout.title', `We did not find any ${type} for the given timerange.`)}
    >
      {t('logs.logs-drilldown.empty-layout.prefix', 'Please')}{' '}
      <a
        className={emptyStateStyles.link}
        href="https://forms.gle/1sYWCTPvD72T1dPH9"
        target="_blank"
        rel="noopener noreferrer"
      >
        {t('logs.logs-drilldown.empty-layout.link', 'let us know')}
      </a>{' '}
      {t('logs.logs-drilldown.empty-layout.suffix', 'if you think this is a mistake.')}
      <Box marginTop={1} justifyContent="center">
        {assistantAvailable && (
          <Button
            variant="secondary"
            onClick={() => solveWithAssistant(type, embeddedOptions?.customPrompt)}
            icon="ai-sparkle"
          >
            {embeddedOptions?.promptCTA ?? 'Ask Grafana Assistant'}
          </Button>
        )}
      </Box>
    </EmptyState>
  );
}

function solveWithAssistant(
  type: 'fields' | 'labels',
  prompt = `Investigate why there are no ${type} to display with the current filters and time range.`
) {
  openAssistant({
    origin: 'logs-drilldown-empty-results',
    prompt,
  });
}
