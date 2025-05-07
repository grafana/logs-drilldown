import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { FieldNameMeta, FieldNameMetaStore } from '../TableTypes';
import { LogsTableActiveFields } from 'Components/Table/ColumnSelection/LogsTableActiveFields';
import { LogsTableAvailableFields } from 'Components/Table/ColumnSelection/LogsTableAvailableFields';

function getStyles(theme: GrafanaTheme2) {
  return {
    columnHeader: css({
      background: theme.colors.background.secondary,
      display: 'flex',
      fontSize: theme.typography.h6.fontSize,
      justifyContent: 'space-between',
      left: 0,
      marginBottom: theme.spacing(2),
      paddingBottom: theme.spacing(0.75),
      paddingLeft: theme.spacing(1.5),
      paddingRight: theme.spacing(0.75),
      paddingTop: theme.spacing(0.75),
      position: 'sticky',
      top: 0,
      zIndex: 3,
    }),
    columnHeaderButton: css({
      appearance: 'none',
      background: 'none',
      border: 'none',
      fontSize: theme.typography.pxToRem(11),
    }),
    sidebarWrap: css({
      /* Hide scrollbar for Chrome, Safari, and Opera */
      '&::-webkit-scrollbar': {
        display: 'none',
      },
      height: 'calc(100% - 50px)',
      overflowY: 'scroll',
      /* Hide scrollbar for Firefox */
      scrollbarWidth: 'none',
    }),
  };
}

export const LogsTableMultiSelect = (props: {
  clear: () => void;
  columnsWithMeta: Record<string, FieldNameMeta>;
  filteredColumnsWithMeta: Record<string, FieldNameMeta> | undefined;
  reorderColumn: (cols: FieldNameMetaStore, oldIndex: number, newIndex: number) => void;
  toggleColumn: (columnName: string) => void;
}) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <div className={styles.sidebarWrap}>
      {/* Sidebar columns */}
      <>
        <div className={styles.columnHeader}>
          Selected fields
          <button onClick={props.clear} className={styles.columnHeaderButton}>
            Reset
          </button>
        </div>
        <LogsTableActiveFields
          reorderColumn={props.reorderColumn}
          toggleColumn={props.toggleColumn}
          labels={props.filteredColumnsWithMeta ?? props.columnsWithMeta}
          valueFilter={(value) => props.columnsWithMeta[value]?.active ?? false}
          id={'selected-fields'}
        />

        <div className={styles.columnHeader}>Fields</div>
        <LogsTableAvailableFields
          toggleColumn={props.toggleColumn}
          labels={props.filteredColumnsWithMeta ?? props.columnsWithMeta}
          valueFilter={(value) => !props.columnsWithMeta[value]?.active}
        />
      </>
    </div>
  );
};
