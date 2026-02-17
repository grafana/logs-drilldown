import React from 'react';

import { Box, Icon, Stack, Text, Tooltip } from '@grafana/ui';

export function DefaultLabels() {
  return (
    <Box
      backgroundColor="primary"
      borderColor="weak"
      borderStyle="solid"
      borderRadius="default"
      marginBottom={2}
      padding={2}
    >
      <Stack gap={0.5} alignItems="center">
        <Text element="h5">Service selection default labels</Text>
        <Tooltip content={'Configure the default labels to show in the landing page of Logs Drilldown'}>
          <Icon name="info-circle" />
        </Tooltip>
      </Stack>
    </Box>
  );
}
