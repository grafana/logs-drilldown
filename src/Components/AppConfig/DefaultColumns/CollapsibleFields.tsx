import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { ControlledCollapse, useStyles2 } from '@grafana/ui';

import { useDefaultColumnsContext } from './Context';
import { Fields } from './Fields';
import { LogsScene } from './LogsScene';
import { RecordsCollapsibleLabel } from './RecordsCollapsibleLabel';
import { LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecord } from './types';

interface Props {
  isOpen: boolean;
  record: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecord;
  recordIndex: number;
}

export function CollapsibleFields({ record, isOpen, recordIndex }: Props) {
  const styles = useStyles2(getStyles);
  const { setExpandedRecords, expandedRecords } = useDefaultColumnsContext();
  return (
    <ControlledCollapse
      className={styles.collapse}
      label={<RecordsCollapsibleLabel record={record} />}
      isOpen={isOpen}
      onToggle={() => {
        if (isOpen) {
          expandedRecords.splice(recordIndex, 1);
          setExpandedRecords(expandedRecords);
        } else {
          setExpandedRecords([...expandedRecords, recordIndex]);
        }
      }}
    >
      <div className={styles.content}>
        <Fields recordIndex={recordIndex} />
      </div>

      <LogsScene recordIndex={recordIndex} />
    </ControlledCollapse>
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
