import { css } from '@emotion/css';
import React, { useCallback } from 'react';

import { LogsSortOrder } from '@grafana/data';
import { GrafanaTheme2 } from '@grafana/data/';
import { IconButton, useStyles2 } from '@grafana/ui';

interface Props {
  sortOrder: LogsSortOrder;
  onSortOrderChange(newOrder: LogsSortOrder): void;
  onManageColumnsClick(): void;
}

export const LogListControls = ({ sortOrder, onSortOrderChange, onManageColumnsClick }: Props) => {
  const styles = useStyles2(getStyles);

  const toggleSortOrder = useCallback(() => {
    onSortOrderChange(sortOrder === LogsSortOrder.Ascending ? LogsSortOrder.Descending : LogsSortOrder.Ascending);
  }, [onSortOrderChange, sortOrder]);

  return (
    <div className={styles.navContainer}>
      <IconButton
        name={sortOrder === LogsSortOrder.Descending ? 'sort-amount-up' : 'sort-amount-down'}
        className={styles.controlButton}
        onClick={toggleSortOrder}
        tooltip={sortOrder === LogsSortOrder.Descending ? 'Newest logs first' : 'Oldest logs first'}
        size="lg"
      />
      <IconButton
        name="columns"
        className={styles.controlButton}
        onClick={onManageColumnsClick}
        tooltip={'Manage columns'}
        size="lg"
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    navContainer: css({
      maxHeight: '100%',
      display: 'flex',
      gap: theme.spacing(3),
      flexDirection: 'column',
      justifyContent: 'flex-start',
      width: theme.spacing(4),
      paddingTop: theme.spacing(0.75),
      paddingLeft: theme.spacing(1),
      borderLeft: `solid 1px ${theme.colors.border.medium}`,
      overflow: 'hidden',
    }),
    controlButton: css({
      margin: 0,
      color: theme.colors.text.secondary,
      height: theme.spacing(2),
    }),
    divider: css({
      borderTop: `solid 1px ${theme.colors.border.medium}`,
      height: 1,
      marginTop: theme.spacing(-0.25),
      marginBottom: theme.spacing(-1.75),
    }),
  };
};
