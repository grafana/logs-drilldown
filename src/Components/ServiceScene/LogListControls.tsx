import React, { useCallback } from 'react';

import { css, cx } from '@emotion/css';

import { GrafanaTheme2, LogsSortOrder } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { LogListControlsOption } from './LogListControlsOption';
import { LogLineState } from 'Components/Table/Context/TableColumnsContext';

interface Props {
  controlsExpanded: boolean;
  disabledLineState?: boolean;
  lineState?: LogLineState;
  onExpandControlsClick: () => void;
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
  controlsExpanded,
  onExpandControlsClick,
}: Props) => {
  const styles = useStyles2(getStyles, controlsExpanded);

  const toggleSortOrder = useCallback(() => {
    onSortOrderChange(sortOrder === LogsSortOrder.Ascending ? LogsSortOrder.Descending : LogsSortOrder.Ascending);
  }, [onSortOrderChange, sortOrder]);

  return (
    <div className={styles.navContainer}>
      <LogListControlsOption
        expanded={controlsExpanded}
        name="arrow-from-right"
        className={cx(styles.controlButton, styles.controlsExpandedButton)}
        variant="secondary"
        onClick={onExpandControlsClick}
        label={
          controlsExpanded
            ? t('logs.logs-controls.label.collapse', 'Expanded')
            : t('logs.logs-controls.label.expand', 'Collapsed')
        }
        tooltip={
          controlsExpanded ? t('logs.logs-controls.collapse', 'Collapse') : t('logs.logs-controls.expand', 'Expand')
        }
        size="lg"
      />
      {onScrollToBottomClick && (
        <LogListControlsOption
          expanded={controlsExpanded}
          name="arrow-down"
          className={styles.controlButton}
          variant="secondary"
          onClick={onScrollToBottomClick}
          tooltip={t('logs.logs-controls.scrollToBottom', 'Scroll to bottom')}
          size="lg"
        />
      )}
      <LogListControlsOption
        expanded={controlsExpanded}
        name={sortOrder === LogsSortOrder.Descending ? 'sort-amount-up' : 'sort-amount-down'}
        className={styles.controlButton}
        onClick={toggleSortOrder}
        tooltip={
          sortOrder === LogsSortOrder.Descending
            ? t('logs.logs-controls.tooltip.sort.oldest-first', 'Set oldest logs first')
            : t('logs.logs-controls.tooltip.sort.newest-first', 'Set newest logs first')
        }
        label={
          sortOrder === LogsSortOrder.Descending
            ? t('logs.logs-controls.labels.sort.oldest-first', 'Newest logs first')
            : t('logs.logs-controls.labels.sort.newest-first', 'Oldest logs first')
        }
        size="lg"
      />
      {wrapLogMessage !== undefined && onWrapLogMessageClick && (
        <LogListControlsOption
          expanded={controlsExpanded}
          name="wrap-text"
          className={wrapLogMessage ? styles.controlButtonActive : styles.controlButton}
          aria-pressed={wrapLogMessage}
          onClick={() => onWrapLogMessageClick(!wrapLogMessage)}
          label={
            wrapLogMessage
              ? t('logs.logs-controls.label.unwrap-lines', 'Wrap lines')
              : t('logs.logs-controls.label.wrap-lines', 'Unwrap lines')
          }
          tooltip={
            wrapLogMessage
              ? t('logs.logs-controls.unwrap-lines', 'Unwrap lines')
              : t('logs.logs-controls.wrap-lines', 'Wrap lines')
          }
          size="lg"
        />
      )}
      {showMetadata !== undefined && onToggleStructuredMetadataClick && (
        <LogListControlsOption
          expanded={controlsExpanded}
          name="document-info"
          aria-pressed={showMetadata}
          className={showMetadata ? styles.controlButtonActive : styles.controlButton}
          onClick={() => onToggleStructuredMetadataClick(!showMetadata)}
          tooltip={
            showMetadata
              ? t('logs.logs-controls.json.tooltip.metadata.disable', 'Hide structured metadata')
              : t('logs.logs-controls.json.tooltip.metadata.enable', 'Show structured metadata')
          }
          label={
            showMetadata
              ? t('logs.logs-controls.json.label.metadata.disable', 'Show metadata')
              : t('logs.logs-controls.json.label.metadata.enable', 'Hide metadata')
          }
          size="lg"
        />
      )}
      {showLabels !== undefined && onToggleLabelsClick && (
        <LogListControlsOption
          expanded={controlsExpanded}
          name="tag-alt"
          aria-pressed={showLabels}
          className={showLabels ? styles.controlButtonActive : styles.controlButton}
          onClick={() => onToggleLabelsClick(!showLabels)}
          tooltip={
            showLabels
              ? t('logs.logs-controls.json.tooltip.labels.disable', 'Hide Labels')
              : t('logs.logs-controls.json.tooltip.labels.enable', 'Show labels')
          }
          label={
            showLabels
              ? t('logs.logs-controls.json.tooltip.labels.enable', 'Show labels')
              : t('logs.logs-controls.json.tooltip.labels.disable', 'Hide Labels')
          }
          size="lg"
        />
      )}
      {showHighlight !== undefined && onToggleHighlightClick && (
        <LogListControlsOption
          expanded={controlsExpanded}
          name="brackets-curly"
          aria-pressed={showHighlight}
          className={showHighlight ? styles.controlButtonActive : styles.controlButton}
          onClick={() => onToggleHighlightClick(!showHighlight)}
          tooltip={
            showHighlight
              ? t('logs.logs-controls.tooltip.highlight.disable', 'Disable highlighting')
              : t('logs.logs-controls.tooltip.highlight.enable', 'Enable highlighting')
          }
          label={
            showHighlight
              ? t('logs.logs-controls.label.highlight.enable', 'Highlight enabled')
              : t('logs.logs-controls.label.highlight.disable', 'Highlight disabled')
          }
          size="lg"
        />
      )}
      {onLineStateClick && lineState && (
        <LogListControlsOption
          expanded={controlsExpanded}
          disabled={disabledLineState}
          name={lineState === LogLineState.text ? 'tag-alt' : 'text-fields'}
          className={styles.controlButton}
          onClick={onLineStateClick}
          tooltip={
            lineState === LogLineState.text
              ? t('logs.logs-controls.table.tooltip.show-labels', 'Show labels')
              : t('logs.logs-controls.table.tooltip.show-text', 'Show log text')
          }
          label={
            lineState === LogLineState.text
              ? t('logs.logs-controls.table.label.show-labels', 'Log text')
              : t('logs.logs-controls.table.label.show-text', 'Log labels')
          }
          size="lg"
        />
      )}
      {onScrollToTopClick && (
        <LogListControlsOption
          stickToBottom={true}
          expanded={controlsExpanded}
          name="arrow-up"
          data-testid="scrollToTop"
          variant="secondary"
          onClick={onScrollToTopClick}
          tooltip={t('logs.logs-controls.scrollToTop', 'Scroll to top')}
          size="lg"
        />
      )}
    </div>
  );
};

export const CONTROLS_WIDTH = 35;
export const CONTROLS_WIDTH_EXPANDED = 176;

const getStyles = (theme: GrafanaTheme2, controlsExpanded: boolean) => {
  return {
    controlsExpandedButton: css({
      transform: !controlsExpanded ? 'rotate(180deg)' : '',
    }),
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
      width: controlsExpanded ? CONTROLS_WIDTH_EXPANDED : CONTROLS_WIDTH,
    }),
    scrollToTopButton: css({
      color: theme.colors.text.secondary,
      height: theme.spacing(2),
      margin: 0,
      marginTop: 'auto',
    }),
  };
};
