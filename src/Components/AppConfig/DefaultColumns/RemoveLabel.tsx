import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';

import { useDefaultColumnsContext } from './Context';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';

interface Props {
  labelIndex: number;
  recordIndex: number;
}
export function RemoveLabel({ recordIndex, labelIndex }: Props) {
  const styles = useStyles2(getStyles);

  const { records, setRecords } = useDefaultColumnsContext();
  const labels = records?.[recordIndex].labels;
  const label = labels?.[labelIndex];

  const onRemoveLabel = () => {
    if (records) {
      const recordToUpdate = records[recordIndex];
      recordToUpdate.labels.splice(labelIndex, 1);
      setRecords(records);
      reportAppInteraction(
        USER_EVENTS_PAGES.default_columns_config,
        USER_EVENTS_ACTIONS.default_columns_config.remove_label
      );
    }
  };

  return (
    <div className={styles.valueContainer}>
      <IconButton
        variant={'destructive'}
        tooltip={`Remove ${label?.key ?? ''}${label?.value ? ` = ${label.value}` : ''}`}
        name={'minus'}
        size={'lg'}
        className={styles.valueContainer__remove}
        onClick={() => onRemoveLabel()}
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
  valueContainer__remove: css({
    marginLeft: theme.spacing(1),
  }),
});
