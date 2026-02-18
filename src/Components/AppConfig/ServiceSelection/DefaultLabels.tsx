import React from 'react';

import { Box, Button, Combobox, Icon, Stack, Text, Tooltip } from '@grafana/ui';

import { useServiceSelectionContext } from './Context';
import { getLabelsForCombobox } from 'services/labels';

export function DefaultLabels() {
  const { dsUID } = useServiceSelectionContext();

  const labelName = '';
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
            value={labelName}
            invalid={!labelName}
            placeholder={'Select label name'}
            width={'auto'}
            minWidth={30}
            maxWidth={90}
            createCustomValue={true}
            onChange={(fieldName) => console.log(fieldName?.value)}
            options={(typeAhead) =>
              getLabelsForCombobox(dsUID).then((opts) => opts.filter((opt) => opt.value.includes(typeAhead)))
            }
          />

          <Button tooltip="Add new label to match against user query" variant="secondary" fill="outline" icon="plus">
            Add label
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
