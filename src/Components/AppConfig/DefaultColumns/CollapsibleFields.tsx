import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Collapse, useStyles2 } from '@grafana/ui';

import { useDefaultColumnsContext } from './Context';
import { Fields } from './Fields';
import { LogsScene } from './LogsScene';
import { RecordsCollapsibleLabel } from './RecordsCollapsibleLabel';

interface Props {
  recordIndex: number;
}

export function CollapsibleFields({ recordIndex }: Props) {
  const { setExpandedRecords, expandedRecords, records } = useDefaultColumnsContext();

  const record = records?.[recordIndex];
  const expandedRecordIdx = expandedRecords?.findIndex((i) => i === recordIndex);
  const expandedRecord = expandedRecordIdx !== -1 ? expandedRecords[expandedRecordIdx] : undefined;
  const isOpen = expandedRecord === recordIndex;

  const styles = useStyles2(getStyles, isOpen);
  if (!record) {
    return null;
  }

  return (
    <Collapse
      className={styles.collapse}
      isOpen={isOpen}
      label={<RecordsCollapsibleLabel record={record} isOpen={isOpen} />}
      onToggle={() => {
        if (isOpen) {
          const expandedRecordsCopy = [...expandedRecords];
          expandedRecordsCopy?.splice(expandedRecordIdx, 1);
          setExpandedRecords(expandedRecordsCopy);
        } else {
          setExpandedRecords([...(expandedRecords ?? []), recordIndex]);
        }
      }}
    >
      <div className={styles.content}>
        <Fields recordIndex={recordIndex} />
      </div>

      <LogsScene recordIndex={recordIndex} />
    </Collapse>
  );
}

const getStyles = (theme: GrafanaTheme2, isOpen: boolean) => ({
  content: css({
    paddingLeft: theme.spacing(2),
  }),
  collapse: css({
    margin: theme.spacing(2),
    boxShadow: theme.shadows.z1,
    width: 'auto',
    '> div:first-of-type': {
      borderBottom: isOpen ? `1px solid ${theme.colors.border.weak}` : 'none',
      boxShadow: isOpen ? theme.shadows.z1 : 'none',
    },
  }),
});
