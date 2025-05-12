import React, { PropsWithChildren } from 'react';

import { css, cx } from '@emotion/css';

import { Field, GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { useTableCellContext } from 'Components/Table/Context/TableCellContext';

interface DefaultCellWrapComponentProps {}

interface Props extends PropsWithChildren<DefaultCellWrapComponentProps> {
  field: Field;
  onClick?: () => void;
  onMouseIn?: () => void;
  onMouseOut?: () => void;
  rowIndex: number;
}

const getStyles = (theme: GrafanaTheme2, bgColor?: string, numberOfMenuItems?: number) => ({
  active: css({
    background: 'transparent',
    // Save 20px for context menu
    height: `calc(${100}% + 36px)`,
    zIndex: theme.zIndex.tooltip,
  }),
  wrap: css({
    background: bgColor ?? 'transparent',
    height: '100%',
    left: 0,
    margin: 'auto',
    overflowX: 'hidden',
    position: 'absolute',
    top: 0,
    whiteSpace: 'nowrap',
    width: '100%',
  }),
});

export const DefaultCellWrapComponent = (props: Props) => {
  return (
    <CellWrapInnerComponent
      onMouseOut={props.onMouseOut}
      onMouseIn={props.onMouseIn}
      onClick={props.onClick}
      field={props.field}
      rowIndex={props.rowIndex}
    >
      {props.children}
    </CellWrapInnerComponent>
  );
};

const CellWrapInnerComponent = (props: Props) => {
  const theme = useTheme2();
  const cellState = useTableCellContext();
  const styles = getStyles(theme, undefined, cellState.cellIndex?.numberOfMenuItems);

  return (
    <div
      onMouseLeave={props.onMouseOut}
      onMouseEnter={props.onMouseIn}
      onClick={props.onClick}
      className={
        cellState.cellIndex.index === props.rowIndex && cellState.cellIndex.fieldName === props.field.name
          ? cx(styles.wrap, styles.active)
          : styles.wrap
      }
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          props.onClick?.();
        }
      }}
      role="button"
      tabIndex={0}
    >
      {props.children}
    </div>
  );
};
