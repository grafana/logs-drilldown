import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Alert, Box, Button, Combobox, ComboboxOption, Icon, MultiCombobox, Stack, Text, Tooltip } from '@grafana/ui';

import { useServiceSelectionContext } from './Context';
import { LabelList } from './LabelList';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { getLabelsForCombobox, getLabelValuesForCombobox } from 'services/labels';
import { SERVICE_NAME } from 'services/variables';

export function DefaultLabels() {
  const { dsUID, currentDefaultLabels, newDefaultLabels, setNewDefaultLabels } = useServiceSelectionContext();
  const [selectedLabel, setSelectedLabel] = useState('');
  const [selectedValues, setSelectedValues] = useState<string[]>([]);

  useEffect(() => {
    reportAppInteraction(USER_EVENTS_PAGES.landing_page, USER_EVENTS_ACTIONS.landing_page.visit);
  }, []);

  const handleLabelChange = useCallback((fieldName: ComboboxOption<string>) => {
    setSelectedLabel(fieldName?.value ?? '');
  }, []);

  const handleValueChange = useCallback((values: Array<ComboboxOption<string>>) => {
    setSelectedValues(values?.map((value) => value.value) ?? []);
  }, []);

  const labels = useMemo(
    () => (newDefaultLabels ? newDefaultLabels : currentDefaultLabels),
    [currentDefaultLabels, newDefaultLabels]
  );

  const getOptions = useCallback(
    (typeAhead: string) =>
      getLabelsForCombobox(
        dsUID,
        labels.map((label) => label.label)
      ).then((opts) => opts.filter((opt) => opt.value.includes(typeAhead))),
    [dsUID, labels]
  );

  const addLabel = useCallback(() => {
    if (selectedLabel) {
      setNewDefaultLabels([...labels, { label: selectedLabel, values: selectedValues }]);
      setSelectedLabel('');
      setSelectedValues([]);

      reportAppInteraction(
        USER_EVENTS_PAGES.landing_page,
        selectedValues.length
          ? USER_EVENTS_ACTIONS.landing_page.add_label_and_values
          : USER_EVENTS_ACTIONS.landing_page.add_label
      );
    }
  }, [labels, selectedLabel, selectedValues, setNewDefaultLabels]);

  const noLabels = (!currentDefaultLabels.length && !newDefaultLabels) || newDefaultLabels?.length === 0;

  return (
    <Box
      backgroundColor="primary"
      borderColor="weak"
      borderStyle="solid"
      borderRadius="default"
      marginBottom={4}
      padding={2}
    >
      <Box marginBottom={2}>
        <Stack gap={0.5} alignItems="center">
          <Text element="h5">
            <Trans i18nKey="components.app-config.service-selection.default-labels.landing-page-default-labels">
              Landing Page default labels
            </Trans>
          </Text>
          <Tooltip
            content={t(
              'components.app-config.service-selection.default-labels.content-configure-default-labels-optional-values-landing',
              'Configure the default labels and optional values to show in the landing page of Logs Drilldown'
            )}
          >
            <Icon name="info-circle" />
          </Tooltip>
        </Stack>
      </Box>

      <Box marginBottom={2}>
        <Stack>
          <Combobox<string>
            value={selectedLabel}
            placeholder={t(
              'components.app-config.service-selection.default-labels.placeholder-select-label-name',
              'Select label name'
            )}
            width={'auto'}
            minWidth={30}
            maxWidth={90}
            createCustomValue={true}
            onChange={handleLabelChange}
            options={getOptions}
          />

          {selectedLabel && (
            <MultiCombobox<string>
              key={selectedLabel}
              placeholder={t(
                'components.app-config.service-selection.default-labels.placeholder-select-values-optional',
                'Select values (optional)'
              )}
              width={'auto'}
              minWidth={30}
              value={selectedValues}
              createCustomValue={true}
              onChange={handleValueChange}
              options={(typeAhead) =>
                getLabelValuesForCombobox(selectedLabel, dsUID).then((opts) =>
                  opts.filter((opt) => opt.value.includes(typeAhead))
                )
              }
            />
          )}
        </Stack>
        {selectedLabel && (
          <Box marginTop={2}>
            <Button
              tooltip={t(
                'components.app-config.service-selection.default-labels.tooltip-label-match-against-query',
                'Add new label to match against user query'
              )}
              variant="secondary"
              fill="outline"
              icon="plus"
              onClick={addLabel}
            >
              {selectedValues.length
                ? t(
                    'components.app-config.service-selection.default-labels.add-label-and-values',
                    'Add label and values'
                  )
                : t('components.app-config.service-selection.default-labels.add-label', 'Add label')}
            </Button>
          </Box>
        )}
      </Box>

      {noLabels ? (
        <Alert title="" severity="info">
          <Trans
            i18nKey="components.app-config.service-selection.default-labels.no-labels-selected"
            values={{ serviceName: SERVICE_NAME }}
          >
            No labels selected. Logs Drilldown will default to <strong>{'{{serviceName}}'}</strong>.
          </Trans>
        </Alert>
      ) : (
        <LabelList />
      )}
    </Box>
  );
}
