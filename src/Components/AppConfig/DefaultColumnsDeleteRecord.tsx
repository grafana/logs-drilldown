import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';

import { useDefaultColumnsContext } from './DefaultColumnsContext';

interface Props {
  recordIndex: number;
}
export function DefaultColumnsDeleteRecord({ recordIndex }: Props) {
  const styles = useStyles2(getStyles);
  const { localDefaultColumnsState, dsUID, setLocalDefaultColumnsDatasourceState } = useDefaultColumnsContext();
  const ds = localDefaultColumnsState?.[dsUID];
  const records = ds?.records;

  if (!records || !records.length || !ds) {
    return null;
  }

  const deleteRecord = () => {
    records.splice(recordIndex, 1);
    setLocalDefaultColumnsDatasourceState({ ...ds, records });
  };

  return (
    <div className={styles.close}>
      <IconButton size={'xl'} name={'times'} aria-labelledby={'Delete record'} onClick={() => deleteRecord()} />
    </div>
  );
}
const getStyles = (theme: GrafanaTheme2) => ({
  close: css({
    position: 'absolute',
    right: '2px',
    top: '6px',
  }),
});
