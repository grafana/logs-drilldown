import { css } from '@emotion/css';
import React, { useCallback } from 'react';

import { LogsSortOrder } from '@grafana/data';
import { GrafanaTheme2 } from '@grafana/data/';
import { IconButton, useStyles2 } from '@grafana/ui';
import { LogLineState } from 'Components/Table/Context/TableColumnsContext';

interface Props {
  sortOrder: LogsSortOrder;
  onSortOrderChange(newOrder: LogsSortOrder): void;
  onManageColumnsClick?(): void;
  onLineStateClick?(): void;
  lineState?: LogLineState;
  onScrollToTopClick?(): void;
  onScrollToBottomClick?(): void;
}

export const LogListControls = ({
  sortOrder,
  onSortOrderChange,
  onManageColumnsClick,
  onLineStateClick,
  lineState,
  onScrollToBottomClick,
  onScrollToTopClick,
}: Props) => {
  const styles = useStyles2(getStyles);

  const toggleSortOrder = useCallback(() => {
    onSortOrderChange(sortOrder === LogsSortOrder.Ascending ? LogsSortOrder.Descending : LogsSortOrder.Ascending);
  }, [onSortOrderChange, sortOrder]);

  return (
    <div className={styles.navContainer}>
      {onScrollToBottomClick && (
        <IconButton
          name="arrow-down"
          className={styles.controlButton}
          variant="secondary"
          onClick={onScrollToBottomClick}
          tooltip={'Scroll to bottom'}
          size="lg"
        />
      )}
      <IconButton
        name={sortOrder === LogsSortOrder.Descending ? 'sort-amount-up' : 'sort-amount-down'}
        className={styles.controlButton}
        onClick={toggleSortOrder}
        tooltip={sortOrder === LogsSortOrder.Descending ? 'Newest logs first' : 'Oldest logs first'}
        size="lg"
      />
      {onManageColumnsClick && (
        <IconButton
          name="columns"
          className={styles.controlButton}
          onClick={onManageColumnsClick}
          tooltip={'Manage columns'}
          size="lg"
        />
      )}
      {onLineStateClick && lineState && (
        <IconButton
          name={lineState === LogLineState.text ? 'brackets-curly' : 'text-fields'}
          className={styles.controlButton}
          onClick={onLineStateClick}
          tooltip={lineState === LogLineState.text ? 'Show labels' : 'Show log text'}
          size="lg"
        />
      )}
      {onScrollToTopClick && (
        <IconButton
          name="arrow-up"
          data-testid="scrollToTop"
          className={styles.scrollToTopButton}
          variant="secondary"
          onClick={onScrollToTopClick}
          tooltip="Scroll to top"
          size="lg"
        />
      )}
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
    scrollToTopButton: css({
      margin: 0,
      marginTop: 'auto',
      color: theme.colors.text.secondary,
      height: theme.spacing(2),
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
