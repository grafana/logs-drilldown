import React, { FormEvent, useCallback, useMemo, useState } from 'react';

import { css } from '@emotion/css';

import { AppEvents, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { sceneGraph, SceneObject } from '@grafana/scenes';
import { Modal, Button, Box, Field, Input, Stack, useStyles2, Alert, Checkbox } from '@grafana/ui';

import { IndexScene } from 'Components/IndexScene/IndexScene';
import { useSaveSearch } from 'services/saveSearch';
import { getQueryExpr } from 'services/scenes';

interface Props {
  dsUid: string;
  onClose(): void;
  sceneRef: SceneObject;
}

export function SaveSearchModal({ dsUid, onClose, sceneRef }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isVisible, setIsVisible] = useState<boolean | undefined>(undefined);
  const [state, setState] = useState<'error' | 'idle' | 'saved' | 'saving'>('idle');
  const styles = useStyles2(getStyles);

  const { saveSearch, backend: saveSearchBackend } = useSaveSearch();

  const indexScene = useMemo(() => sceneGraph.getAncestor(sceneRef, IndexScene), [sceneRef]);
  const query = useMemo(() => getQueryExpr(indexScene), [indexScene]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const appEvents = getAppEvents();

      try {
        setState('saving');
        await saveSearch({ description, dsUid, isVisible, query, title });
        setState('saved');

        appEvents.publish({
          payload: [t('logs.logs-drilldown.save-search.success', 'Search successfully saved.')],
          type: AppEvents.alertSuccess.name,
        });

        onClose();
      } catch (e) {
        console.error(e);
        setState('error');

        appEvents.publish({
          payload: [t('logs.logs-drilldown.save-search.error', 'Unexpected error saving this search.')],
          type: AppEvents.alertError.name,
        });
      }
    },
    [description, dsUid, isVisible, onClose, query, saveSearch, title]
  );

  return (
    <Modal
      title={t('logs.logs-drilldown.save-search.modal-title', 'Save current search')}
      isOpen={true}
      onDismiss={onClose}
    >
      <Box marginBottom={2}>
        <code className={styles.query}>{query}</code>
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
            {saveSearchBackend === 'remote' && (
              <Field>
                <Checkbox
                  label={t('logs.logs-drilldown.save-search.share-with-users', 'Share with all users')}
                  checked={isVisible}
                  onChange={(e: FormEvent<HTMLInputElement>) => setIsVisible(e.currentTarget.checked)}
                />
              </Field>
            )}
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
          <Alert title="Succcess" severity="success">
            {t('logs.logs-drilldown.save-search.success', 'Search successfully saved.')}
          </Alert>
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
    backgroundColor: theme.colors.background.elevated,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    padding: theme.spacing(1),
    display: 'block',
    whiteSpace: 'wrap',
  }),
});
