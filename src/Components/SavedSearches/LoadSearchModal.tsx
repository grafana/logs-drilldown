import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';

import { css } from '@emotion/css';

import { dateTime, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph, SceneObject } from '@grafana/scenes';
import {
  Modal,
  Box,
  useStyles2,
  LoadingPlaceholder,
  Stack,
  Text,
  Divider,
  ScrollContainer,
  LinkButton,
  IconButton,
} from '@grafana/ui';

import { contextToLink } from 'services/extensions/links';
import { useSavedSearches, SavedSearch, useDeleteSearch, useEditSearch } from 'services/saveSearch';
import { getDataSourceVariable } from 'services/variableGetters';

interface Props {
  onClose(): void;
  sceneRef: SceneObject;
}

export function LoadSearchModal({ onClose, sceneRef }: Props) {
  const [selectedSearch, setSelectedSearch] = useState<SavedSearch | null>(null);
  const styles = useStyles2(getStyles);

  const dsUid = useMemo(() => getDataSourceVariable(sceneRef).getValue().toString(), [sceneRef]);
  const sceneTimeRange = useMemo(() => sceneGraph.getTimeRange(sceneRef).state.value, [sceneRef]);

  const searches = useSavedSearches(dsUid);
  const { deleteSearch } = useDeleteSearch();
  const { editSearch } = useEditSearch();

  useEffect(() => {
    const selected = searches.find((search) => search === selectedSearch);
    if (!selected && searches.length) {
      setSelectedSearch(
        selectedSearch ? searches.find((search) => search.uid === selectedSearch.uid) ?? searches[0] : searches[0]
      );
    }
  }, [selectedSearch, searches]);

  const href = useMemo(() => {
    if (!selectedSearch) {
      return '';
    }
    return (
      contextToLink({
        targets: [
          {
            refId: 'A',
            datasource: {
              uid: selectedSearch?.dsUid,
              type: 'loki',
            },
            // @ts-expect-error
            expr: selectedSearch.query,
          },
        ],
        timeRange: sceneTimeRange,
      })?.path ?? ''
    );
  }, [sceneTimeRange, selectedSearch]);

  const formattedTime = useMemo(
    () => (selectedSearch ? dateTime(selectedSearch.timestamp).format('ddd MMM DD YYYY HH:mm [GMT]ZZ') : ''),
    [selectedSearch]
  );

  const onDelete = useCallback(() => {
    if (!selectedSearch) {
      return;
    }
    deleteSearch(selectedSearch.uid);
  }, [deleteSearch, selectedSearch]);

  const onLockToggle = useCallback(async () => {
    if (!selectedSearch) {
      return;
    }
    editSearch(selectedSearch.uid, {
      isLocked: !selectedSearch.isLocked,
    });
  }, [editSearch, selectedSearch]);

  return (
    <Modal
      title={t('logs.logs-drilldown.load-search.modal-title', 'Load a previously saved search')}
      isOpen={true}
      onDismiss={onClose}
    >
      {!searches ||
        (searches.length === 0 && (
          <Box backgroundColor="secondary" padding={1.5} marginBottom={2}>
            {!searches && <LoadingPlaceholder text="Loading your searches..." />}
            {!searches.length && (
              <Text variant="body">{t('logs.logs-drilldown.load-search.empty', 'No saved searches to display.')}</Text>
            )}
          </Box>
        ))}
      {searches.length > 0 && (
        <Stack flex={1} gap={0} minHeight={25}>
          <Box display="flex" flex={1} minWidth={0}>
            <ScrollContainer>
              <Stack direction="column" gap={0} flex={1} minWidth={0} role="radiogroup">
                {searches.map((search, i) => (
                  <SavedSearchItem
                    key={i}
                    search={search}
                    selected={search === selectedSearch}
                    onSelect={setSelectedSearch}
                  />
                ))}
              </Stack>
            </ScrollContainer>
            <Divider direction="vertical" spacing={0} />
          </Box>
          <Box display="flex" flex={2} minWidth={0}>
            <ScrollContainer>
              {selectedSearch && (
                <Box
                  direction="column"
                  display="flex"
                  gap={1}
                  flex={1}
                  paddingBottom={0}
                  paddingLeft={2}
                  paddingRight={1}
                >
                  <Text variant="h5" truncate>
                    {selectedSearch.title}
                  </Text>
                  <Text variant="bodySmall" truncate>
                    {formattedTime}
                  </Text>
                  {selectedSearch.description && (
                    <Text variant="body" truncate>
                      {selectedSearch.description}
                    </Text>
                  )}

                  <code className={styles.query}>{selectedSearch.query}</code>
                  <Box display="flex" flex={1} justifyContent="flex-end" direction="column">
                    <Stack justifyContent="space-between">
                      <Box display="flex" gap={1}>
                        {selectedSearch.isLocked !== undefined && (
                          <IconButton
                            tooltip={
                              selectedSearch.isLocked
                                ? t('query-library.actions.unlock-query-button', 'Unlock query')
                                : t('query-library.actions.lock-query-button', 'Lock query')
                            }
                            name={selectedSearch.isLocked ? 'unlock' : 'lock'}
                            onClick={onLockToggle}
                            size="xl"
                          />
                        )}
                        <IconButton
                          size="xl"
                          name="trash-alt"
                          disabled={selectedSearch.isLocked}
                          onClick={onDelete}
                          tooltip={
                            selectedSearch.isLocked
                              ? t('logs.logs-drilldown.load-search.remove-locked', 'Unlock to remove')
                              : t('logs.logs-drilldown.load-search.remove', 'Remove')
                          }
                        />
                      </Box>
                      <LinkButton onClick={onClose} href={href} variant="primary">
                        {t('logs.logs-drilldown.load-search.select', 'Select')}
                      </LinkButton>
                    </Stack>
                  </Box>
                </Box>
              )}
            </ScrollContainer>
          </Box>
        </Stack>
      )}
    </Modal>
  );
}

interface SavedSearchItemProps {
  onSelect(search: SavedSearch): void;
  search: SavedSearch;
  selected?: boolean;
}

function SavedSearchItem({ onSelect, search, selected }: SavedSearchItemProps) {
  const styles = useStyles2(getStyles);

  const id = useId();
  return (
    // eslint-disable-next-line jsx-a11y/label-has-associated-control
    <label className={styles.label} htmlFor={id}>
      <input
        // only the selected item should be tabbable
        // arrow keys should navigate between items
        tabIndex={selected ? 0 : -1}
        type="radio"
        id={id}
        name="saved-searches"
        className={styles.input}
        onChange={() => onSelect(search)}
        checked={selected}
      />
      <Stack alignItems="center" justifyContent="space-between">
        <Stack minWidth={0}>
          <Text truncate>{search.title ?? ''}</Text>
        </Stack>
      </Stack>
    </label>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  query: css({
    backgroundColor: theme.colors.background.elevated,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    padding: theme.spacing(1),
    marginBottom: theme.spacing(1),
    display: 'block',
    whiteSpace: 'wrap',
  }),
  input: css({
    cursor: 'pointer',
    inset: 0,
    opacity: 0,
    position: 'absolute',
  }),
  label: css({
    width: '100%',
    padding: theme.spacing(2, 2, 2, 1),
    position: 'relative',

    // Add transitions for smooth highlighting fade-out
    [theme.transitions.handleMotion('no-preference')]: {
      transition: theme.transitions.create(['background-color', 'border-color'], {
        duration: theme.transitions.duration.standard,
      }),
    },

    ':has(:checked)': {
      backgroundColor: theme.colors.action.selected,
    },

    ':has(:focus-visible)': css({
      backgroundColor: theme.colors.action.hover,
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: '-2px',
    }),

    '.favoriteButton': {
      display: 'none',
    },
    ':has(:hover)': {
      '.favoriteButton': {
        display: 'inline-flex',
      },
    },
  }),
});
