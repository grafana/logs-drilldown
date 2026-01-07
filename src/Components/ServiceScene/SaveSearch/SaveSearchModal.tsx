import React, { useCallback } from 'react';

import { t } from '@grafana/i18n';
import { Modal, Button, Box, Field, Input, Stack } from '@grafana/ui';

interface Props {
  onClose(): void;
}

export function SaveSearchModal({ onClose }: Props) {
  const handleSubmit = useCallback(() => {}, []);

  return (
    <Modal title="Save current search" isOpen={true} onDismiss={onClose}>
      <form onSubmit={handleSubmit}>
        <Stack gap={1} direction="column" minWidth={0} flex={1}>
          <Box flex={1} marginBottom={2}>
            <Field label={t('logs.logs-drilldown.save-search.title', 'Title')} noMargin htmlFor="save-search-title">
              <Input id="save-search-title" />
            </Field>
          </Box>
          <Box flex={1} marginBottom={2}>
            <Field
              label={t('logs.logs-drilldown.save-search.description', 'Description')}
              noMargin
              htmlFor="save-search-description"
            >
              <Input id="save-search-description" />
            </Field>
          </Box>
        </Stack>
        <Modal.ButtonRow>
          <Button variant="secondary" fill="outline">
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </Modal.ButtonRow>
      </form>
    </Modal>
  );
}
