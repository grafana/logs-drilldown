import React, { useCallback, useMemo, useState } from 'react';

import { Alert, Box, Button, Combobox, ComboboxOption, Icon, MultiCombobox, Stack, Text, Tooltip } from '@grafana/ui';

import { useServiceSelectionContext } from './Context';
import { LabelList } from './LabelList';
import { getLabelsForCombobox, getLabelValuesForCombobox } from 'services/labels';
import { SERVICE_NAME } from 'services/variables';

export function DefaultLabels() {
  const { dsUID, currentDefaultLabels, newDefaultLabels, setNewDefaultLabels } = useServiceSelectionContext();
  const [selectedLabel, setSelectedLabel] = useState('');
  const [selectedValues, setSelectedValues] = useState<string[]>([]);

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
          <Text element="h5">Landing Page default labels</Text>
          <Tooltip
            content={'Configure the default labels and optional values to show in the landing page of Logs Drilldown'}
          >
            <Icon name="info-circle" />
          </Tooltip>
        </Stack>
      </Box>

      <Box marginBottom={2}>
        <Stack>
          <Combobox<string>
            value={selectedLabel}
            placeholder={'Select label name'}
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
              placeholder={'Select values (optional)'}
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
              tooltip="Add new label to match against user query"
              variant="secondary"
              fill="outline"
              icon="plus"
              onClick={addLabel}
            >
              {selectedValues.length ? 'Add label and values' : 'Add label'}
            </Button>
          </Box>
        )}
      </Box>

      {noLabels ? (
        <Alert title="" severity="info">
          No labels selected. Logs Drilldown will default to <strong>{SERVICE_NAME}</strong>.
        </Alert>
      ) : (
        <LabelList />
      )}
    </Box>
  );
}
