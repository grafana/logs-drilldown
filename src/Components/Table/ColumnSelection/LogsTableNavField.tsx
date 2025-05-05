import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Checkbox, Icon, useTheme2 } from '@grafana/ui';

import { FieldNameMeta } from '../TableTypes';

export function LogsTableNavField(props: {
  columnWidthMap?: Record<string, number>;
  draggable?: boolean;
  label: string;
  labels: Record<string, FieldNameMeta>;
  onChange: () => void;
  setColumnWidthMap?: (map: Record<string, number>) => void;
  showCount?: boolean;
}): React.JSX.Element | null {
  const theme = useTheme2();
  const styles = getStyles(theme);

  if (props.labels[props.label]) {
    return (
      <>
        <div className={styles.contentWrap}>
          <Checkbox
            className={styles.checkboxLabel}
            label={props.label}
            onChange={props.onChange}
            checked={props.labels[props.label]?.active ?? false}
          />
          {props.showCount && (
            <div className={styles.labelCount}>
              <div>{props.labels[props.label]?.percentOfLinesWithLabel}%</div>
              <div>
                {props.labels[props.label]?.cardinality}{' '}
                {props.labels[props.label]?.cardinality === 1 ? 'value' : 'values'}
              </div>
            </div>
          )}
          {props.columnWidthMap && props.setColumnWidthMap && props.columnWidthMap?.[props.label] !== undefined && (
            <button
              onClick={() => {
                const { [props.label]: omit, ...map } = { ...props.columnWidthMap };
                props.setColumnWidthMap?.(map);
              }}
              title={'Clear column width override'}
              className={styles.customWidthWrap}
            >
              Reset column width
              <Icon name={'x'} />
            </button>
          )}
        </div>
        {props.draggable && (
          <Icon
            aria-label="Drag and drop icon"
            title="Drag and drop to reorder"
            name="draggabledots"
            size="lg"
            className={styles.dragIcon}
          />
        )}
      </>
    );
  }

  return null;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    // Hide text that overflows, had to select elements within the Checkbox component, so this is a bit fragile
    checkboxLabel: css({
      '> span': {
        display: 'block',
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
    }),
    contentWrap: css({
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'space-between',
      width: '100%',
    }),
    customWidthWrap: css({
      cursor: 'pointer',
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    dragIcon: css({
      cursor: 'drag',
      marginLeft: theme.spacing(1),
      opacity: 0.4,
    }),
    labelCount: css({
      alignItems: 'self-end',
      appearance: 'none',
      background: 'none',
      border: 'none',
      display: 'flex',
      flexDirection: 'column',
      fontSize: theme.typography.pxToRem(11),
      marginLeft: theme.spacing(0.5),
      marginRight: theme.spacing(0.5),
      opacity: 0.6,
    }),
  };
}
