import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';

import { useDefaultColumnsContext } from './DefaultColumnsContext';

interface Props {
  recordIndex: number;
}
export function DefaultColumnsAddLabel({ recordIndex }: Props) {
  const styles = useStyles2(getStyles);

  const { localDefaultColumnsState, dsUID, setLocalDefaultColumnsDatasourceState } = useDefaultColumnsContext();

  // @todo don't allow more then one empty record or the react keys get messed up and things get weird!
  const onAddLabelValue = () => {
    if (localDefaultColumnsState && localDefaultColumnsState[dsUID]) {
      const ds = localDefaultColumnsState[dsUID];
      const records = [...ds.records];
      const beforeThisRecord = records.slice(0, recordIndex);
      const thisRecord = records.splice(recordIndex, 1)[0];
      const afterThisRecord = records.slice(recordIndex, records.length);
      const newrecords = [
        ...beforeThisRecord,
        { ...thisRecord, labels: [...(thisRecord?.labels ?? []), { key: '' }] },
        ...afterThisRecord,
      ];

      // This is messing up the order
      setLocalDefaultColumnsDatasourceState({
        ...ds,
        records: newrecords,
      });
    }
  };

  return (
    <div className={styles.valueContainer}>
      <IconButton
        variant={'secondary'}
        tooltip={`Add label`}
        name={'plus-circle'}
        size={'lg'}
        className={styles.valueContainer__add}
        onClick={() => onAddLabelValue()}
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
  valueContainer__add: css({
    marginLeft: theme.spacing(2),
  }),
});
