import React, { FormEvent, useCallback, useRef, useState } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Modal, Button, Box, Field, Input, Stack, useStyles2 } from '@grafana/ui';

interface Props {
  onClose(): void;
  query: string;
}

export function SaveSearchModal({ onClose, query }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const handleSubmit = useCallback(() => {}, []);
  const titleRef = useRef<HTMLInputElement | null>(null);
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
              <Input
                id="save-search-title"
                required
                ref={titleRef}
                value={title}
                onChange={(e: FormEvent<HTMLInputElement>) => setTitle(e.currentTarget.value)}
              />
            </Field>
          </Box>
          <Box flex={1} marginBottom={2}>
            <Field
              label={t('logs.logs-drilldown.save-search.description', 'Description')}
              noMargin
              htmlFor="save-search-description"
            >
              <Input
                id="save-search-description"
                value={description}
                onChange={(e: FormEvent<HTMLInputElement>) => setTitle(e.currentTarget.value)}
              />
            </Field>
          </Box>
        </Stack>
        <Modal.ButtonRow>
          <Button variant="secondary" fill="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!title}>
            Save
          </Button>
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
