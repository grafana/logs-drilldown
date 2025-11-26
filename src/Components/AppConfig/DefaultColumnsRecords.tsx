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

interface RecordsProps {}

export const DefaultColumnsRecords = ({}: RecordsProps) => {
  const styles = useStyles2(getStyles);
  const { localDefaultColumnsState, dsUID, setLocalDefaultColumnsDatasourceState } = useDefaultColumnsContext();

  if (!localDefaultColumnsState?.[dsUID]) {
    throw new Error('Records::missing localDefaultColumnsState');
  }

  console.log('record', localDefaultColumnsState[dsUID]?.records);

  return (
    <div className={styles.recordsContainer}>
      {localDefaultColumnsState[dsUID]?.records.map(
        (record: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecord, recordIndex: number) => {
          return (
            <div className={styles.recordContainer} key={recordIndex}>
              <h5 className={styles.labelContainer__title}>
                Labels
                <Tooltip content={'Any query containing all of these labels will display the selected columns'}>
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

              <div>
                <h5 className={styles.labelContainer__title}>
                  Columns
                  <Tooltip content={'These columns will be displayed by default within the logs visualizations.'}>
                    <Icon name="info-circle" />
                  </Tooltip>
                </h5>

                {/* Add columns @todo */}
                <Button
                  tooltip={'Add a default column to display in the logs'}
                  variant={'secondary'}
                  fill={'outline'}
                  aria-label={`Add label`}
                  icon={'plus'}
                  onClick={() => console.warn('@todo add field')}
                  className={styles.fieldsContainer}
                >
                  Add column
                </Button>
              </div>
            </div>
          );
        }
      )}

      <Button
        variant={'secondary'}
        fill={'outline'}
        icon={'plus'}
        // disabled={
        //   !!localDefaultColumnsState[dsUID]?.records.find((r) => r.columns.length === 0 || r.labels.length === 0)
        // }
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
  labelContainer__add: css({
    marginLeft: theme.spacing(2),
  }),
  labelContainer__name: css({}),
  labelsContainer: css({
    label: 'labelsContainer',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
  }),
  labelContainer: css({
    display: 'flex',
    label: 'valuesContainer',
    marginLeft: theme.spacing(2),
    marginBottom: theme.spacing(1),
    marginTop: theme.spacing(1),
  }),
  valueContainer: css({
    label: 'valueContainer',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  }),
  fieldsContainer: css({
    alignSelf: 'flex-start',
    marginLeft: theme.spacing(2),
  }),

  valueContainer__name: css({}),
  valueContainer__remove: css({
    marginLeft: theme.spacing(1),
  }),
});
