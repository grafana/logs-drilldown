import React, { useCallback } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Modal, Button, Box, Field, Input, Stack, useStyles2 } from '@grafana/ui';

interface Props {
  onClose(): void;
  query: string;
}

export function SaveSearchModal({ onClose, query }: Props) {
  const handleSubmit = useCallback(() => {}, []);
  const styles = useStyles2(getStyles);

  return (
    <Modal title="Save current search" isOpen={true} onDismiss={onClose}>
      <Box backgroundColor="secondary" padding={1.5} marginBottom={2}>
        <div className={styles.query}>{query}</div>
      </Box>
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

const getStyles = (theme: GrafanaTheme2) => ({
  query: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
