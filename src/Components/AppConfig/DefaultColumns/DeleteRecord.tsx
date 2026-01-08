import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';

import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../../services/analytics';
import { useDefaultColumnsContext } from './Context';

interface Props {
  recordIndex: number;
}
export function DeleteRecord({ recordIndex }: Props) {
  const styles = useStyles2(getStyles);
  const { records, setRecords } = useDefaultColumnsContext();

  if (!records) {
    return null;
  }

  const deleteRecord = () => {
    records.splice(recordIndex, 1);
    setRecords(records);
    reportAppInteraction(
      USER_EVENTS_PAGES.default_columns_config,
      USER_EVENTS_ACTIONS.default_columns_config.delete_record
    );
  };

  return (
    <div className={styles.close}>
      <IconButton
        tooltip={'Delete record'}
        size={'xl'}
        name={'times'}
        aria-labelledby={'Delete record'}
        onClick={() => deleteRecord()}
      />
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
