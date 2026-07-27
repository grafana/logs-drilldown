import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { isAssistantAvailable, openAssistant } from '@grafana/assistant';
import { t } from '@grafana/i18n';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Box, Button, EmptyState, Stack } from '@grafana/ui';

import { emptyStateStyles } from './FieldsBreakdownScene';
import { getEmptyStateOptions } from 'services/extensions/embedding';
import { getParserEnabled, setParserEnabled } from 'services/parserToggle';
import { useSharedStyles } from 'styles/shared-styles';

export interface EmptyLayoutSceneState extends SceneObjectState {
  type: 'fields' | 'labels';
}

export class EmptyLayoutScene extends SceneObjectBase<EmptyLayoutSceneState> {
  public static Component = EmptyLayoutComponent;
}

function EmptyLayoutComponent({ model }: SceneComponentProps<EmptyLayoutScene>) {
  const sharedStyles = useSharedStyles();
  const [assistantAvailable, setAssistantAvailable] = useState<boolean | undefined>(undefined);
  const { type } = model.useState();

  useEffect(() => {
    const sub = isAssistantAvailable().subscribe((isAvailable: boolean) => {
      setAssistantAvailable(isAvailable);
    });
    return () => sub.unsubscribe();
  }, []);

  const embeddedOptions = getEmptyStateOptions(type, model);

  const noFieldsAndParsersDisabled = type === 'fields' && getParserEnabled() === false;

  const message = useMemo(() => {
    if (noFieldsAndParsersDisabled) {
      return t(
        'components.service-scene.breakdowns.empty-layout-scene.parsed-fields',
        'We did not find any {{type}} for the given time range. Try enabling extracted fields from the log lines.',
        {
          type,
        }
      );
    }
    return t(
      'components.service-scene.breakdowns.empty-layout-scene.title',
      'We did not find any {{type}} for the given time range.',
      {
        type,
      }
    );
  }, [noFieldsAndParsersDisabled, type]);

  const enableParsers = useCallback(() => {
    setParserEnabled(true, model);
  }, [model]);

  return (
    <div className={sharedStyles.emptyStateWrap}>
      <EmptyState variant="not-found" message={message}>
        {t('components.service-scene.breakdowns.empty-layout-scene.prefix', 'Please')}{' '}
        <a
          className={emptyStateStyles.link}
          href="https://forms.gle/1sYWCTPvD72T1dPH9"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('components.service-scene.breakdowns.empty-layout-scene.link', 'let us know')}
        </a>{' '}
        {t('components.service-scene.breakdowns.empty-layout-scene.suffix', 'if you think this is a mistake.')}
        <Box marginTop={1} justifyContent="center">
          <Stack gap={1}>
            {assistantAvailable && (
              <Button
                variant="secondary"
                onClick={() => solveWithAssistant(type, embeddedOptions?.customPrompt)}
                icon="ai-sparkle"
              >
                {embeddedOptions?.promptCTA ??
                  t('components.service-scene.breakdowns.empty-layout-scene.ask-assistant', 'Ask Grafana Assistant')}
              </Button>
            )}
            {noFieldsAndParsersDisabled && (
              <Button variant="primary" onClick={enableParsers}>
                {t('components.service-scene.breakdowns.empty-layout-scene.enable-parsers', 'Enable extracted fields')}
              </Button>
            )}
          </Stack>
        </Box>
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
