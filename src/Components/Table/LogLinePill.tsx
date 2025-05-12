import React, { useMemo } from 'react';

import { css, cx } from '@emotion/css';
import { Row } from 'react-table';

import { DataFrame, Field, FieldType, getLinksSupplier, GrafanaTheme2, LinkModel } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { getCellLinks, useTheme2 } from '@grafana/ui';

import { LEVEL_NAME } from './constants';
import { CellContextMenu } from 'Components/Table/CellContextMenu';
import { useTableCellContext } from 'Components/Table/Context/TableCellContext';
import { useTableColumnContext } from 'Components/Table/Context/TableColumnsContext';
import { getFieldMappings } from 'Components/Table/Table';
import { FieldNameMetaStore } from 'Components/Table/TableTypes';
import { useSharedStyles } from 'styles/shared-styles';

interface LogLinePillProps {
  columns: FieldNameMetaStore;
  field?: Field;
  frame: DataFrame;
  isDerivedField: boolean;
  label: string;
  originalField?: Field;
  originalFrame: DataFrame | undefined;
  rowIndex: number;
  showColumns: () => void;
  value: string;
}

const getStyles = (theme: GrafanaTheme2, levelColor?: string) => ({
  activePill: css({}),
  pill: css({
    display: 'inline-flex',
    flex: '0 1 auto',
    flexDirection: 'column',
    marginLeft: theme.spacing(0.5),
    marginRight: theme.spacing(0.5),
    marginTop: theme.spacing(0.5),
    padding: `${theme.spacing(0.25)} ${theme.spacing(0.25)}`,
    position: 'relative',
  }),
  valueWrap: css({
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
    border: `1px solid ${theme.colors.background.secondary}`,
    boxShadow: `-2px 2px 5px 0px ${theme.colors.background.secondary}`,

    cursor: 'pointer',
    paddingLeft: levelColor ? `${theme.spacing(0.75)}` : `${theme.spacing(0.5)}`,

    paddingRight: `${theme.spacing(0.5)}`,

    position: 'relative',
  }),
});

function LogLinePillValue(props: {
  fieldType?: 'derived';
  label: string;
  links?: LinkModel[];
  menuActive: boolean;
  onClick: () => void;
  onClickAdd: () => void;
  value: string;
}) {
  const theme = useTheme2();
  const { linkButton } = useSharedStyles();

  let levelColor;
  if (props.label === LEVEL_NAME) {
    const mappings = getFieldMappings().options;
    if (props.value in mappings) {
      levelColor = mappings[props.value].color;
    }
  }

  const styles = getStyles(theme, levelColor);

  return (
    <button
      className={cx(linkButton, styles.pill, props.menuActive ? styles.activePill : undefined)}
      onClick={props.onClick}
    >
      <span className={styles.valueWrap}>
        {props.label}={props.value}
      </span>
      {props.menuActive && (
        <CellContextMenu
          pillType={'logPill'}
          fieldType={props.fieldType}
          links={props.links}
          label={props.label}
          value={props.value}
          showColumn={props.onClickAdd}
        />
      )}
    </button>
  );
}

export const LogLinePill = (props: LogLinePillProps) => {
  const { label } = props;
  const { cellIndex, setActiveCellIndex } = useTableCellContext();
  const { columns, setColumns } = useTableColumnContext();
  const value = props.value;
  const templateSrv = getTemplateSrv();
  const replace = useMemo(() => templateSrv.replace.bind(templateSrv), [templateSrv]);

  // Need untransformed frame for links?
  const field = props.field;

  if (!field || field?.type === FieldType.other) {
    return null;
  }
  const row = { index: props.rowIndex } as Row;

  if (props.originalField && props.isDerivedField && props.originalFrame) {
    props.originalField.getLinks = getLinksSupplier(props.originalFrame, props.originalField, {}, replace);
  }

  const links = props.originalField && getCellLinks(props.originalField, row);

  /**
   * This Could be moved?
   * Callback called by the pill context menu
   * @param fieldName
   */
  const addFieldToColumns = (fieldName: string) => {
    const pendingColumns = { ...columns };

    const length = Object.keys(columns).filter((c) => columns[c].active).length;
    if (pendingColumns[fieldName].active) {
      pendingColumns[fieldName] = {
        ...pendingColumns[fieldName],
        active: false,
        index: undefined,
      };
    } else {
      pendingColumns[fieldName] = {
        ...pendingColumns[fieldName],
        active: true,
        index: length,
      };
    }

    setColumns(pendingColumns);
  };

  return (
    <LogLinePillValue
      onClick={() => {
        if (
          props.rowIndex === cellIndex.index &&
          field.name === cellIndex.fieldName &&
          label === cellIndex.subFieldName
        ) {
          return setActiveCellIndex({ index: null });
        }

        return setActiveCellIndex({
          fieldName: field.name,
          index: props.rowIndex,
          numberOfMenuItems: props.isDerivedField ? 2 : 3,
          subFieldName: label,
        });
      }}
      menuActive={
        cellIndex.index === props.rowIndex && cellIndex.fieldName === field.name && cellIndex.subFieldName === label
      }
      fieldType={props.isDerivedField ? 'derived' : undefined}
      label={label}
      value={value}
      onClickAdd={() => addFieldToColumns(label)}
      links={links}
    />
  );
};
