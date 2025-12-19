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
  const styles = useStyles2(getStyles);
  const { setExpandedRecords, expandedRecords, records } = useDefaultColumnsContext();
  if (!records) {
    return null;
  }

  const record = records[recordIndex];
  const expandedRecordIdx = expandedRecords?.findIndex((i) => i === recordIndex);
  const expandedRecord = expandedRecordIdx !== -1 ? expandedRecords[expandedRecordIdx] : undefined;
  const isOpen = expandedRecord === recordIndex;
  return (
    <Collapse
      className={styles.collapse}
      isOpen={isOpen}
      label={<RecordsCollapsibleLabel record={record} />}
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

const getStyles = (theme: GrafanaTheme2) => ({
  content: css({
    paddingLeft: theme.spacing(2),
  }),
  collapse: css({
    margin: theme.spacing(2),
    width: 'auto',
  }),
});
