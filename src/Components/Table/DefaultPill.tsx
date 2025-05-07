import React, { ReactElement } from 'react';

import { css, cx } from '@emotion/css';

import { Field, FieldType, GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { LEVEL_NAME } from './constants';
import { CellContextMenu } from 'Components/Table/CellContextMenu';
import { useTableCellContext } from 'Components/Table/Context/TableCellContext';
import { getFieldMappings } from 'Components/Table/Table';

interface DefaultPillProps {
  field: Field;
  label: string;
  rowIndex: number;
  showColumns?: () => void;
  value: string | unknown | ReactElement;
}

const getStyles = (theme: GrafanaTheme2, levelColor?: string) => ({
  activePillWrap: css({}),
  menu: css({
    width: '100%',
  }),
  menuItem: css({
    overflow: 'auto',
    textOverflow: 'ellipsis',
  }),
  menuItemText: css({
    display: 'inline-block',
    width: '65px',
  }),
  pill: css({
    '&:before': {
      backgroundColor: levelColor,
      content: '""',
      height: '100%',
      left: 0,
      position: 'absolute',
      top: 0,
      width: `${theme.spacing(0.25)}`,
    },
    '&:hover': {
      border: `1px solid ${theme.colors.border.strong}`,
    },
    backgroundColor: 'transparent',
    border: `1px solid ${theme.colors.border.weak}`,
    display: 'inline-flex',
    flexDirection: 'row-reverse',
    marginLeft: '5px',
    marginRight: '5px',
    marginTop: '4px',
    padding: '2px 5px',

    paddingLeft: levelColor ? `${theme.spacing(0.75)}` : `2px`,

    position: 'relative',
  }),
  pillWrap: css({
    width: '100%',
  }),
});
export const DefaultPill = (props: DefaultPillProps) => {
  const { label, value } = props;
  const theme = useTheme2();
  const { cellIndex } = useTableCellContext();
  let levelColor;

  if (label === LEVEL_NAME) {
    const mappings = getFieldMappings().options;
    if (typeof value === 'string' && value in mappings) {
      levelColor = mappings[value].color;
    }
  }

  const isPillActive = cellIndex.index === props.rowIndex && props.field.name === cellIndex.fieldName;

  const styles = getStyles(theme, levelColor);
  return (
    <div className={cx(styles.pillWrap, isPillActive ? styles.activePillWrap : undefined)}>
      {!!value && (
        <>
          <span className={styles.pill}>
            <>{value}</>
          </span>
          {isPillActive && typeof value === 'string' && props.field.type !== FieldType.time && (
            <CellContextMenu label={props.label} value={value} pillType={'column'} />
          )}
        </>
      )}
    </div>
  );
};
