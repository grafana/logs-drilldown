import React, { useCallback, useMemo, useState } from 'react';

import { Alert, Box, Button, Combobox, ComboboxOption, Icon, Stack, Text, Tooltip } from '@grafana/ui';

import { useServiceSelectionContext } from './Context';
import { LabelList } from './LabelList';
import { getLabelsForCombobox } from 'services/labels';
import { SERVICE_NAME } from 'services/variables';

export function DefaultLabels() {
  const { dsUID, currentDefaultLabels, newDefaultLabels, setNewDefaultLabels } = useServiceSelectionContext();
  const [selectedLabel, setSelectedLabel] = useState('');

  const handleChange = useCallback((fieldName: ComboboxOption<string>) => {
    setSelectedLabel(fieldName?.value ?? '');
  }, []);

  const labels = useMemo(
    () => (newDefaultLabels.length ? newDefaultLabels : currentDefaultLabels),
    [currentDefaultLabels, newDefaultLabels]
  );

  const getOptions = useCallback(
    (typeAhead: string) =>
      getLabelsForCombobox(dsUID, labels).then((opts) => opts.filter((opt) => opt.value.includes(typeAhead))),
    [dsUID, labels]
  );

  const addLabel = useCallback(() => {
    if (selectedLabel) {
      setNewDefaultLabels([...labels, selectedLabel]);
      setSelectedLabel('');
    }
  }, [labels, selectedLabel, setNewDefaultLabels]);

  const noLabels = !currentDefaultLabels.length && !newDefaultLabels.length;

  return (
    <Box
      backgroundColor="primary"
      borderColor="weak"
      borderStyle="solid"
      borderRadius="default"
      marginBottom={2}
      padding={2}
    >
      <Box marginBottom={2}>
        <Stack gap={0.5} alignItems="center">
          <Text element="h5">Service selection default labels</Text>
          <Tooltip content={'Configure the default labels to show in the landing page of Logs Drilldown'}>
            <Icon name="info-circle" />
          </Tooltip>
        </Stack>
      </Box>

      <Box marginBottom={2}>
        <Stack>
          <Combobox<string>
            value={selectedLabel}
            invalid={!selectedLabel}
            placeholder={'Select label name'}
            width={'auto'}
            minWidth={30}
            maxWidth={90}
            createCustomValue={true}
            onChange={handleChange}
            options={getOptions}
          />

          <Button
            tooltip="Add new label to match against user query"
            variant="secondary"
            fill="outline"
            icon="plus"
            onClick={addLabel}
          >
            Add label
          </Button>
        </Stack>
      </Box>

      {noLabels ? (
        <Alert title="" severity="info">
          No labels selected. Logs Drilldown will default to {SERVICE_NAME}
        </Alert>
      ) : (
        <LabelList />
      )}
    </Box>
  );
}
