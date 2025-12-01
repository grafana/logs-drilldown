import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';

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
    <div className={styles.labelContainer}>
      <Button
        tooltip={'Add new label to match against user query'}
        variant={'secondary'}
        fill={'outline'}
        aria-label={`Add label`}
        icon={'plus'}
        onClick={() => onAddLabelValue()}
        className={styles.labelContainer__add}
      >
        Add label
      </Button>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  labelContainer: css({
    label: 'labelContainer',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  }),
  labelContainer__name: css({}),
  labelContainer__add: css({}),
});
