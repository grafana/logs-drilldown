import React, { useEffect, useState } from 'react';

import { isAssistantAvailable, openAssistant } from '@grafana/assistant';
import { t } from '@grafana/i18n';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Button, EmptyState, Stack } from '@grafana/ui';

import { emptyStateStyles } from './FieldsBreakdownScene';
import { getEmptyStateOptions } from 'services/extensions/embedding';
import { useSharedStyles } from 'styles/shared-styles';

export interface ClearFiltersLayoutSceneState extends SceneObjectState {
  clearCallback: () => void;
  type?: 'fields' | 'labels';
}
export class NoMatchingLabelsScene extends SceneObjectBase<ClearFiltersLayoutSceneState> {
  public static Component = NoMatchingLabelsComponent;
}

function NoMatchingLabelsComponent({ model }: SceneComponentProps<NoMatchingLabelsScene>) {
  const sharedStyles = useSharedStyles();
  const [assistantAvailable, setAssistantAvailable] = useState<boolean | undefined>(undefined);
  const { clearCallback, type = 'labels' } = model.useState();

  useEffect(() => {
    isAssistantAvailable().subscribe((isAvailable: boolean) => {
      setAssistantAvailable(isAvailable);
    });
  }, []);

  const embeddedOptions = getEmptyStateOptions(type, model);

  return (
    <div className={sharedStyles.emptyStateWrap}>
      <EmptyState
        variant="not-found"
        message={t('logs.logs-drilldown.no-matching-labels.title', 'No {{type}} match these filters.', { type })}
      >
        <Stack justifyContent="center">
          <Button className={emptyStateStyles.button} onClick={() => clearCallback()}>
            {t('logs.logs-drilldown.no-matching-labels.clear-filters', 'Clear filters')}
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
      </EmptyState>
    </div>
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
