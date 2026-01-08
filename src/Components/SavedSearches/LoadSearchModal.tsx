import React, { useEffect, useState } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneObject } from '@grafana/scenes';
import { Modal, Button, Box, useStyles2, LoadingPlaceholder } from '@grafana/ui';

import { logger } from 'services/logger';
import { getSavedSearches, SavedSearch } from 'services/saveSearch';
import { getDataSourceVariable } from 'services/variableGetters';

interface Props {
  onClose(): void;
  sceneRef: SceneObject;
}

export function LoadSearchModal({ onClose, sceneRef }: Props) {
  const [searches, setSearches] = useState<SavedSearch[] | undefined>(undefined);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    const dsUid = getDataSourceVariable(sceneRef).getValue().toString();
    getSavedSearches(dsUid)
      .then(setSearches)
      .catch((e) => {
        logger.error(e);
        setSearches([]);
      });
  }, [sceneRef]);

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
