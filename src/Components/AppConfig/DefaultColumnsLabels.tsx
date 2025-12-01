import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';

import { DefaultColumnsAddLabel } from './DefaultColumnsAddLabel';
import { useDefaultColumnsContext } from './DefaultColumnsContext';
import { DefaultColumnsLabelName } from './DefaultColumnsLabelName';
import { DefaultColumnsLabelValue } from './DefaultColumnsLabelValue';
import { DefaultColumnsRemoveLabel } from './DefaultColumnsRemoveLabel';
import { LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsLabel } from './types';

interface Props {
  recordIndex: number;
}
export function DefaultColumnsLabels({ recordIndex }: Props) {
  const { localDefaultColumnsState, dsUID } = useDefaultColumnsContext();
  const styles = useStyles2(getStyles);
  if (!localDefaultColumnsState?.[dsUID]) {
    throw new Error('Records::missing localDefaultColumnsState');
  }
  const record = localDefaultColumnsState[dsUID].records[recordIndex];
  return (
    <>
      <h5 className={styles.labelTitle}>
        Labels match
        <Tooltip content={'Queries containing these labels will display the selected columns'}>
          <Icon className={styles.labelIcon} name="info-circle" />
        </Tooltip>
      </h5>
      {record.labels?.map((label: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsLabel, labelIndex: number) => {
        const labelName = label.key;
        const labelValue = label.value;
        return (
          <div key={labelIndex} className={styles.labelContainer__wrap}>
            {/* Label/values */}
            <div className={styles.labelContainer}>
              <DefaultColumnsLabelName currentLabel={labelName} recordIndex={recordIndex} labelIndex={labelIndex} />

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
      })}

      <DefaultColumnsAddLabel recordIndex={recordIndex} />
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  labelTitle: css({
    marginTop: theme.spacing(1.5),
    display: 'flex',
    alignItems: 'center',
  }),
  labelIcon: css({
    marginLeft: theme.spacing(0.5),
  }),
  labelContainer__wrap: css({
    display: 'flex',
    flexDirection: 'column',
  }),
  labelContainer: css({
    label: 'labelContainer',
    display: 'flex',
    marginBottom: theme.spacing(1),
    marginTop: theme.spacing(1),
  }),
});
