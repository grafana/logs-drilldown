import React from 'react';

import { OpenAssistantButton } from '@grafana/assistant';
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
  const { clearCallback, type = 'labels' } = model.useState();

  const embeddedOptions = getEmptyStateOptions(type, model);

  return (
    <div className={sharedStyles.emptyStateWrap}>
      <EmptyState
        variant="not-found"
        message={t(
          'components.service-scene.breakdowns.no-matching-labels-scene.title',
          'No {{type}} match these filters.',
          {
            type,
          }
        )}
      >
        <Stack justifyContent="center">
          <Button className={emptyStateStyles.button} onClick={() => clearCallback()}>
            {t('components.service-scene.breakdowns.no-matching-labels-scene.clear-filters', 'Clear filters')}
          </Button>
          <OpenAssistantButton
            size="md"
            origin="logs-drilldown-empty-results"
            prompt={
              embeddedOptions?.customPrompt ??
              `Investigate why there are no ${type} to display with the current filters and time range.`
            }
            title={embeddedOptions?.promptCTA ?? 'Ask Grafana Assistant'}
          />
        </Stack>
      </EmptyState>
    </div>
  );
}
