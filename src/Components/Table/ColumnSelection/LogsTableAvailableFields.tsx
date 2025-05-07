import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { FieldNameMeta } from '../TableTypes';
import { LogsTableEmptyFields } from './LogsTableEmptyFields';
import { LogsTableNavField } from './LogsTableNavField';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

function getLogsFieldsStyles(theme: GrafanaTheme2) {
  return {
    columnWrapper: css({
      marginBottom: theme.spacing(1.5),
      // need some space or the outline of the checkbox is cut off
      paddingLeft: theme.spacing(0.5),
    }),
    dragging: css({
      background: theme.colors.background.secondary,
    }),
    wrap: css({
      background: theme.colors.background.primary,
      borderBottom: `1px solid ${theme.colors.background.canvas}`,
      display: 'flex',
      marginBottom: theme.spacing(0.25),
      marginTop: theme.spacing(0.25),
    }),
  };
}

function sortLabels(labels: Record<string, FieldNameMeta>) {
  return (a: string, b: string) => {
    const la = labels[a];
    const lb = labels[b];

    // ...sort by type and alphabetically
    if (la != null && lb != null) {
      return (
        Number(lb.type === 'TIME_FIELD') - Number(la.type === 'TIME_FIELD') ||
        Number(lb.type === 'BODY_FIELD') - Number(la.type === 'BODY_FIELD') ||
        collator.compare(a, b)
      );
    }

    // otherwise do not sort
    return 0;
  };
}

export const LogsTableAvailableFields = (props: {
  labels: Record<string, FieldNameMeta>;
  toggleColumn: (columnName: string) => void;
  valueFilter: (value: string) => boolean;
}): React.ReactElement => {
  const { labels, toggleColumn, valueFilter } = props;
  const theme = useTheme2();
  const styles = getLogsFieldsStyles(theme);
  const labelKeys = Object.keys(labels).filter((labelName) => valueFilter(labelName));
  if (labelKeys.length) {
    // Otherwise show list with a hardcoded order
    return (
      <div className={styles.columnWrapper}>
        {labelKeys.sort(sortLabels(labels)).map((labelName) => (
          <div
            key={labelName}
            className={styles.wrap}
            title={`${labelName} appears in ${labels[labelName]?.percentOfLinesWithLabel}% of log lines`}
          >
            <LogsTableNavField
              showCount={true}
              label={labelName}
              onChange={() => toggleColumn(labelName)}
              labels={labels}
            />
          </div>
        ))}
      </div>
    );
  }

  return <LogsTableEmptyFields />;
};
