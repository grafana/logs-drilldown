import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { ControlledCollapse, useStyles2 } from '@grafana/ui';

import { useDefaultColumnsContext } from './DefaultColumnsContext';
import { DefaultColumnsFields } from './DefaultColumnsFields';
import { DefaultColumnsLogsScene } from './DefaultColumnsLogsScene';
import { DefaultColumnsRecordsCollapsibleLabel } from './DefaultColumnsRecordsCollapsibleLabel';
import { LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecord } from './types';

interface Props {
  isOpen: boolean;
  record: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecord;
  recordIndex: number;
}

export function DefaultColumnsCollapsibleFields({ record, isOpen, recordIndex }: Props) {
  const styles = useStyles2(getStyles);
  const { setExpandedRecords, expandedRecords } = useDefaultColumnsContext();
  return (
    <ControlledCollapse
      className={styles.collapse}
      label={<DefaultColumnsRecordsCollapsibleLabel record={record} />}
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
        <DefaultColumnsFields recordIndex={recordIndex} />
      </div>

      <DefaultColumnsLogsScene recordIndex={recordIndex} />
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
