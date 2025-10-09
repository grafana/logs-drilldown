import React, { useEffect, useState } from 'react';

import { isAssistantAvailable, openAssistant } from '@grafana/assistant';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Alert, Box, Button } from '@grafana/ui';

import { GrotError } from '../../GrotError';
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
    isAssistantAvailable().subscribe((isAvailable: boolean) => {
      setAssistantAvailable(isAvailable);
    });
  }, []);

  const embeddedOptions = getEmptyStateOptions(type, model);

  return (
    <GrotError>
      <Alert title="" severity="warning">
        We did not find any {type} for the given timerange. Please{' '}
        <a
          className={emptyStateStyles.link}
          href="https://forms.gle/1sYWCTPvD72T1dPH9"
          target="_blank"
          rel="noopener noreferrer"
        >
          let us know
        </a>{' '}
        if you think this is a mistake.
      </Alert>
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
    </GrotError>
  );
}

function solveWithAssistant(
  type: 'fields' | 'labels',
  prompt = `'Investigate why there are no ${type} to display with the current filters and time range.'`
) {
  openAssistant({
    origin: 'logs-drilldown-empty-results',
    prompt,
  });
}
