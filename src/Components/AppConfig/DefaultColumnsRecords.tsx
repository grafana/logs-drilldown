import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Divider, Icon, Tooltip, useStyles2 } from '@grafana/ui';

import { DefaultColumnsAddLabel } from './DefaultColumnsAddLabel';
import { useDefaultColumnsContext } from './DefaultColumnsContext';
import { DefaultColumnsLabelName } from './DefaultColumnsLabelName';
import { DefaultColumnsLabelValue } from './DefaultColumnsLabelValue';
import { DefaultColumnsRemoveLabel } from './DefaultColumnsRemoveLabel';
import {
  LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsLabel,
  LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecord,
} from './types';
import { DefaultColumnsFields } from './DefaultColumnsFields';

interface RecordsProps {}

export const DefaultColumnsRecords = ({}: RecordsProps) => {
  const styles = useStyles2(getStyles);
  const { localDefaultColumnsState, dsUID, setLocalDefaultColumnsDatasourceState } = useDefaultColumnsContext();

  if (!localDefaultColumnsState?.[dsUID]) {
    throw new Error('Records::missing localDefaultColumnsState');
  }

  console.log('localDefaultColumnsState[dsUID]', localDefaultColumnsState[dsUID]);

  return (
    <div className={styles.recordsContainer}>
      {localDefaultColumnsState[dsUID]?.records.map(
        (record: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecord, recordIndex: number) => {
          return (
            <div className={styles.recordContainer} key={recordIndex}>
              <h5 className={styles.labelContainer__title}>
                Labels match
                <Tooltip content={'Queries containing these labels will display the selected columns'}>
                  <Icon name="info-circle" />
                </Tooltip>
              </h5>
              {record.labels?.map(
                (label: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsLabel, labelIndex: number) => {
                  const labelName = label.key;
                  const labelValue = label.value;
                  return (
                    <div key={labelIndex} className={styles.labelContainer__wrap}>
                      {/* Label/values */}
                      <div className={styles.labelContainer}>
                        <DefaultColumnsLabelName
                          currentLabel={labelName}
                          recordIndex={recordIndex}
                          labelIndex={labelIndex}
                        />

                        {/* Check that labelName is truthy or the label values call will fail*/}
                        {labelName && (
                          <DefaultColumnsLabelValue
                            labelValue={labelValue}
                            labelName={labelName}
                            recordIndex={recordIndex}
                            labelIndex={labelIndex}
                          />
                        )}

                        <DefaultColumnsRemoveLabel
                          labelName={labelName}
                          labelValue={labelValue}
                          recordIndex={recordIndex}
                          labelIndex={labelIndex}
                        />
                      </div>
                    </div>
                  );
                }
              )}

              <DefaultColumnsAddLabel recordIndex={recordIndex} />

              <Divider />

              <DefaultColumnsFields recordIndex={recordIndex} />
            </div>
          );
        }
      )}

      <Button
        variant={'secondary'}
        fill={'outline'}
        icon={'plus'}
        disabled={
          // @todo perf
          !!localDefaultColumnsState[dsUID]?.records.find(
            (r) => !(r.columns.length && r.labels.length && r.labels.some((l) => l.key === ''))
          )
        }
        onClick={() => {
          setLocalDefaultColumnsDatasourceState({
            // Add new record with empty label name
            records: [...(localDefaultColumnsState[dsUID]?.records ?? []), { columns: [], labels: [{ key: '' }] }],
          });
        }}
      >
        Add record
      </Button>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  recordContainer: css({
    border: `1px solid ${theme.colors.border.weak}`,
    paddingBottom: theme.spacing(2),
    marginBottom: theme.spacing(3),
  }),
  recordsContainer: css({
    paddingBottom: theme.spacing(2),
  }),
  labelContainer__title: css({
    marginTop: theme.spacing(1.5),
    marginLeft: theme.spacing(2),
  }),
  labelContainer__wrap: css({
    label: 'labelContainer',
    display: 'flex',
    flexDirection: 'column',
  }),
  labelContainer: css({
    display: 'flex',
    label: 'valuesContainer',
    marginLeft: theme.spacing(2),
    marginBottom: theme.spacing(1),
    marginTop: theme.spacing(1),
  }),
});
