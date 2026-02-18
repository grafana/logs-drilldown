import React from 'react';

import { Box, Icon, IconButton, Stack } from '@grafana/ui';

import { useServiceSelectionContext } from './Context';
import { getNormalizedFieldName } from 'Components/ServiceScene/LogOptionsScene';

export function LabelList() {
  const { currentDefaultLabels, newDefaultLabels } = useServiceSelectionContext();

  const labels = newDefaultLabels.length ? newDefaultLabels : currentDefaultLabels;

  return (
    <Box
      backgroundColor="primary"
      borderColor="weak"
      borderStyle="solid"
      borderRadius="default"
      marginBottom={2}
      padding={2}
    >
      {labels.map((label) => (
        <Label key={label} label={label} />
      ))}
    </Box>
  );
}

export function Label({ label }: { label: string }) {
  return (
    <Stack>
      <Icon aria-label="Drag and drop icon" title="Drag and drop to reorder" name="draggabledots" size="lg" />
      <div>{label}</div>
      <IconButton
        variant={'destructive'}
        tooltip={`Remove ${getNormalizedFieldName(label)}`}
        name={'minus'}
        size={'lg'}
      />
    </Stack>
  );
}
