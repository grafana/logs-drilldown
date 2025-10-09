import React, { useEffect, useState } from 'react';

import { isAssistantAvailable, openAssistant } from '@grafana/assistant';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Alert, Button, Stack } from '@grafana/ui';

import { GrotError } from '../../GrotError';
import { emptyStateStyles } from './FieldsBreakdownScene';
import { getEmptyStateOptions } from 'services/extensions/embedding';

export interface ClearFiltersLayoutSceneState extends SceneObjectState {
  clearCallback: () => void;
  type?: 'fields' | 'labels';
}
export class NoMatchingLabelsScene extends SceneObjectBase<ClearFiltersLayoutSceneState> {
  public static Component = NoMatchingLabelsComponent;
}

function NoMatchingLabelsComponent({ model }: SceneComponentProps<NoMatchingLabelsScene>) {
  const [assistantAvailable, setAssistantAvailable] = useState<boolean | undefined>(undefined);
  const { clearCallback, type = 'labels' } = model.useState();

  useEffect(() => {
    isAssistantAvailable().subscribe((isAvailable: boolean) => {
      setAssistantAvailable(isAvailable);
    });
  }, []);

  const embeddedOptions = getEmptyStateOptions(type, model);

  return (
    <GrotError>
      <p>No {type} match these filters.</p>
      <Stack justifyContent="center">
        <Button className={emptyStateStyles.button} onClick={() => clearCallback()}>
          Clear filters
        </Button>
        {assistantAvailable && (
          <Button
            variant="secondary"
            onClick={() => solveWithAssistant(type, embeddedOptions?.customPrompt)}
            icon="ai-sparkle"
          >
            {embeddedOptions?.promptCTA ?? 'Ask Grafana Assistant'}
          </Button>
        )}
      </Stack>
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
