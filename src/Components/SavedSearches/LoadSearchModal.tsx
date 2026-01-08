import React, { FormEvent, useCallback, useEffect, useState } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Modal, Button, Box, Field, Input, Stack, useStyles2, LoadingPlaceholder } from '@grafana/ui';

import { logger } from 'services/logger';
import { getSavedSearches, SavedSearch } from 'services/saveSearch';

interface Props {
  onClose(): void;
}

export function LoadSearchModal({ onClose }: Props) {
  const [searches, setSearches] = useState<SavedSearch[] | undefined>(undefined);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    getSavedSearches()
      .then(setSearches)
      .catch((e) => {
        logger.error(e);
        setSearches([]);
      });
  }, []);

  return (
    <Modal title="Load a previously saved search" isOpen={true} onDismiss={onClose}>
      {!searches ||
        (searches.length === 0 && (
          <Box backgroundColor="secondary" padding={1.5} marginBottom={2}>
            {!searches && <LoadingPlaceholder text="Loading your searches..." />}
            {!searches.length && <p>No saved searches to display.</p>}
          </Box>
        ))}
      {searches?.map((search, i) => (
        <Box key={i} backgroundColor="secondary" padding={1.5} marginBottom={2}>
          {search.query}
        </Box>
      ))}
      <Modal.ButtonRow>
        <Button variant="secondary" fill="outline" onClick={onClose}>
          Close
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  query: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
