import React, { useCallback } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2, LogsSortOrder } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, useStyles2 } from '@grafana/ui';

import { LogLineState } from 'Components/Table/Context/TableColumnsContext';

interface Props {
  disabledLineState?: boolean;
  lineState?: LogLineState;
  onLineStateClick?(): void;
  onScrollToBottomClick?(): void;
  onScrollToTopClick?(): void;
  onSortOrderChange(newOrder: LogsSortOrder): void;
  onToggleHighlightClick?(visible: boolean): void;
  onToggleLabelsClick?(visible: boolean): void;
  onToggleStructuredMetadataClick?(visible: boolean): void;
  onWrapLogMessageClick?(wrap: boolean): void;
  showHighlight?: boolean;
  showLabels?: boolean;
  showMetadata?: boolean;
  sortOrder: LogsSortOrder;
  wrapLogMessage?: boolean;
}

export const LogListControls = ({
  disabledLineState,
  lineState,
  onLineStateClick,
  onScrollToBottomClick,
  onScrollToTopClick,
  onSortOrderChange,
  onToggleHighlightClick,
  onToggleLabelsClick,
  onToggleStructuredMetadataClick,
  onWrapLogMessageClick,
  showHighlight,
  showLabels,
  showMetadata,
  sortOrder,
  wrapLogMessage,
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
      {wrapLogMessage !== undefined && onWrapLogMessageClick && (
        <IconButton
          name="wrap-text"
          className={wrapLogMessage ? styles.controlButtonActive : styles.controlButton}
          aria-pressed={wrapLogMessage}
          onClick={() => onWrapLogMessageClick(!wrapLogMessage)}
          tooltip={
            wrapLogMessage
              ? t('logs.logs-controls.unwrap-lines', 'Unwrap lines')
              : t('logs.logs-controls.wrap-lines', 'Wrap lines')
          }
          size="lg"
        />
      )}
      {showMetadata !== undefined && onToggleStructuredMetadataClick && (
        <IconButton
          name="document-info"
          aria-pressed={showMetadata}
          className={showMetadata ? styles.controlButtonActive : styles.controlButton}
          onClick={() => onToggleStructuredMetadataClick(!showMetadata)}
          tooltip={showMetadata ? 'Hide structured metadata' : 'Show structured metadata'}
          size="lg"
        />
      )}
      {showLabels !== undefined && onToggleLabelsClick && (
        <IconButton
          name="tag-alt"
          aria-pressed={showLabels}
          className={showLabels ? styles.controlButtonActive : styles.controlButton}
          onClick={() => onToggleLabelsClick(!showLabels)}
          tooltip={showLabels ? 'Hide Labels' : 'Show labels'}
          size="lg"
        />
      )}
      {showHighlight !== undefined && onToggleHighlightClick && (
        <IconButton
          name="brackets-curly"
          aria-pressed={showHighlight}
          className={showHighlight ? styles.controlButtonActive : styles.controlButton}
          onClick={() => onToggleHighlightClick(!showHighlight)}
          tooltip={showHighlight ? 'Disable highlighting' : 'Enable highlighting'}
          size="lg"
        />
      )}
      {onLineStateClick && lineState && (
        <IconButton
          disabled={disabledLineState}
          name={lineState === LogLineState.text ? 'tag-alt' : 'text-fields'}
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
    controlButton: css({
      color: theme.colors.text.secondary,
      height: theme.spacing(2),
      margin: 0,
    }),
    controlButtonActive: css({
      '&:after': {
        backgroundImage: theme.colors.gradients.brandHorizontal,
        borderRadius: theme.shape.radius.default,
        bottom: theme.spacing(-1),
        content: '" "',
        display: 'block',
        height: 2,
        opacity: 1,
        position: 'absolute',
        width: '95%',
      },
      color: theme.colors.text.secondary,
      height: theme.spacing(2),
      margin: 0,
    }),
    divider: css({
      borderTop: `solid 1px ${theme.colors.border.medium}`,
      height: 1,
      marginBottom: theme.spacing(-1.75),
      marginTop: theme.spacing(-0.25),
    }),
    navContainer: css({
      borderLeft: `solid 1px ${theme.colors.border.medium}`,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(3),
      justifyContent: 'flex-start',
      maxHeight: '100%',
      overflow: 'hidden',
      paddingLeft: theme.spacing(1),
      paddingTop: theme.spacing(0.75),
      width: theme.spacing(4),
    }),
    scrollToTopButton: css({
      color: theme.colors.text.secondary,
      height: theme.spacing(2),
      margin: 0,
      marginTop: 'auto',
    }),
  };
};
