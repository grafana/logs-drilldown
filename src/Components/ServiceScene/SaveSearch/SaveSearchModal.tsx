import React, { FormEvent, useCallback, useRef, useState } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Modal, Button, Box, Field, Input, Stack, useStyles2 } from '@grafana/ui';

import { saveSearch } from 'services/saveSearch';

interface Props {
  onClose(): void;
  query: string;
}

export function SaveSearchModal({ onClose, query }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [state, setState] = useState<'error' | 'idle' | 'saved' | 'saving'>('idle');
  const styles = useStyles2(getStyles);

  const handleSubmit = useCallback(async () => {
    try {
      setState('saving');
      await saveSearch(query, title, description);
      setState('saved');
    } catch (e) {
      console.error(e);
      setState('error');
    }
  }, [description, query, title]);

  return (
    <Modal title="Save current search" isOpen={true} onDismiss={onClose}>
      <Box backgroundColor="secondary" padding={1.5} marginBottom={2}>
        <div className={styles.query}>{query}</div>
      </Box>
      {state !== 'saved' ? (
        <form onSubmit={handleSubmit}>
          <Stack gap={1} direction="column" minWidth={0} flex={1}>
            <Box flex={1} marginBottom={2}>
              <Field label={t('logs.logs-drilldown.save-search.title', 'Title')} noMargin htmlFor="save-search-title">
                <Input
                  id="save-search-title"
                  required
                  value={title}
                  onChange={(e: FormEvent<HTMLInputElement>) => setTitle(e.currentTarget.value)}
                  disabled={state === 'saving'}
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
                  onChange={(e: FormEvent<HTMLInputElement>) => setDescription(e.currentTarget.value)}
                  disabled={state === 'saving'}
                />
              </Field>
            </Box>
          </Stack>
          <Modal.ButtonRow>
            <Button variant="secondary" fill="outline" onClick={onClose} disabled={state === 'saving'}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title || state === 'saving'}>
              Save
            </Button>
          </Modal.ButtonRow>
        </form>
      ) : (
        <>
          <Box marginBottom={2}>
            {t(
              'logs.logs-drilldown.save-search.success',
              'Search successfully saved. You can load it again from the landing page of Logs Drilldown.'
            )}
          </Box>
          <Modal.ButtonRow>
            <Button variant="secondary" fill="outline" onClick={onClose}>
              Close
            </Button>
          </Modal.ButtonRow>
        </>
      )}
    </Modal>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  query: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
