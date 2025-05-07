import React, { useCallback, useState } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { ClipboardButton, IconButton, Modal, useTheme2 } from '@grafana/ui';

import { testIds } from '../../services/testIds';
import { useQueryContext } from 'Components/Table/Context/QueryContext';
import { generateLogShortlink } from 'services/text';

export const getStyles = (theme: GrafanaTheme2, bgColor?: string) => ({
  clipboardButton: css({
    height: '100%',
    lineHeight: '1',
    padding: 0,
    width: '20px',
  }),
  iconWrapper: css({
    background: theme.colors.background.secondary,
    boxShadow: theme.shadows.z2,
    display: 'flex',
    height: '35px',
    left: 0,
    padding: `0 ${theme.spacing(0.5)}`,
    position: 'sticky',
    zIndex: 1,
  }),
  inspect: css({
    '&:hover': {
      color: theme.colors.text.link,
      cursor: 'pointer',
    },

    padding: '5px 3px',
  }),
  inspectButton: css({
    borderRadius: '5px',
    display: 'inline-flex',
    margin: 0,
    overflow: 'hidden',
    verticalAlign: 'middle',
  }),
});
export function LineActionIcons(props: { rowIndex: number; value: unknown }) {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const { logsFrame, timeRange } = useQueryContext();
  const logId = logsFrame?.idField?.values[props.rowIndex];
  const lineValue = logsFrame?.bodyField.values[props.rowIndex];
  const [isInspecting, setIsInspecting] = useState(false);
  const getText = useCallback(() => {
    if (timeRange) {
      return generateLogShortlink('selectedLine', { id: logId, row: props.rowIndex }, timeRange);
    }
    return '';
  }, [logId, props.rowIndex, timeRange]);
  return (
    <>
      <div className={styles.iconWrapper}>
        <div className={styles.inspect}>
          <IconButton
            data-testid={testIds.table.inspectLine}
            className={styles.inspectButton}
            tooltip="View log line"
            variant="secondary"
            aria-label="View log line"
            tooltipPlacement="top"
            size="md"
            name="eye"
            onClick={() => setIsInspecting(true)}
            tabIndex={0}
          />
        </div>
        <div className={styles.inspect}>
          <ClipboardButton
            className={styles.clipboardButton}
            icon="share-alt"
            variant="secondary"
            fill="text"
            size="md"
            tooltip="Copy link to log line"
            tooltipPlacement="top"
            tabIndex={0}
            getText={getText}
          />
        </div>
      </div>
      <>
        {isInspecting && (
          <Modal onDismiss={() => setIsInspecting(false)} isOpen={true} title="Inspect value">
            <pre>{lineValue}</pre>
            <Modal.ButtonRow>
              <ClipboardButton icon="copy" getText={() => props.value as string}>
                Copy to Clipboard
              </ClipboardButton>
            </Modal.ButtonRow>
          </Modal>
        )}
      </>
    </>
  );
}
