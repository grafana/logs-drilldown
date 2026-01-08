import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';

import { AddLabel } from './AddLabel';
import { useDefaultColumnsContext } from './Context';
import { LabelName } from './LabelName';
import { LabelValue } from './LabelValue';
import { RemoveLabel } from './RemoveLabel';

interface Props {
  recordIndex: number;
}
export function Labels({ recordIndex }: Props) {
  const { records } = useDefaultColumnsContext();
  const styles = useStyles2(getStyles);
  if (!records) {
    throw new Error('Records::missing localDefaultColumnsState');
  }
  const record = records[recordIndex];
  return (
    <>
      <h5 className={styles.labelTitle}>
        Labels match
        <Tooltip content={'Queries containing these labels will display the selected columns'}>
          <Icon className={styles.labelIcon} name="info-circle" />
        </Tooltip>
      </h5>
      {record.labels?.map((_, labelIndex: number) => {
        return (
          <div key={labelIndex} className={styles.labelContainer__wrap}>
            <div className={styles.labelContainer}>
              <LabelName recordIndex={recordIndex} labelIndex={labelIndex} />
              <LabelValue recordIndex={recordIndex} labelIndex={labelIndex} />
              {record.labels.length > 1 && <RemoveLabel recordIndex={recordIndex} labelIndex={labelIndex} />}
            </div>
          </div>
        );
      })}

      <AddLabel recordIndex={recordIndex} />
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
