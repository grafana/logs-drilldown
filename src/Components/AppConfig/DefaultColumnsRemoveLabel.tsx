import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';

import { useDefaultColumnsContext } from './DefaultColumnsContext';

interface Props {
  labelIndex: number;
  labelName: string;
  labelValue?: string;
  recordIndex: number;
}
export function DefaultColumnsRemoveLabel({ labelName, labelValue, recordIndex, labelIndex }: Props) {
  const styles = useStyles2(getStyles);

  const { localDefaultColumnsState, dsUID, setLocalDefaultColumnsDatasourceState } = useDefaultColumnsContext();

  const onRemoveLabelValue = () => {
    if (localDefaultColumnsState && localDefaultColumnsState[dsUID]) {
      const ds = localDefaultColumnsState[dsUID];
      const records = ds.records;
      const recordToUpdate = records[recordIndex];
      recordToUpdate.labels.splice(labelIndex, 1);
      setLocalDefaultColumnsDatasourceState({ ...ds, records });
    }
  };

  return (
    <div className={styles.valueContainer}>
      <IconButton
        variant={'destructive'}
        tooltip={`Remove ${labelName ?? ''}${labelValue ?? '' ? ` = ${labelValue}` : ''}`}
        name={'minus'}
        size={'lg'}
        className={styles.valueContainer__remove}
        onClick={() => onRemoveLabelValue()}
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  valueContainer: css({
    label: 'valueContainer',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  }),
  valueContainer__name: css({}),
  valueContainer__remove: css({
    marginLeft: theme.spacing(1),
  }),
});
