import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, useStyles2 } from '@grafana/ui';

import { useDefaultColumnsContext } from './Context';
import { isRecordLabelsValid } from './Validation';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';

interface Props {
  recordIndex: number;
}
export function AddLabel({ recordIndex }: Props) {
  const { setRecords, records } = useDefaultColumnsContext();
  const record = records?.[recordIndex] ?? null;
  const isInvalid = !!record && !isRecordLabelsValid(record);
  const styles = useStyles2(getStyles);

  // @todo don't allow more then one empty record or the react keys get messed up and things get weird!
  const onAddLabel = () => {
    if (records) {
      const beforeThisRecord = records.slice(0, recordIndex);
      const thisRecord = records.splice(recordIndex, 1)[0];
      const afterThisRecord = records.slice(recordIndex, records.length);
      const newRecords = [
        ...beforeThisRecord,
        { ...thisRecord, labels: [...(thisRecord?.labels ?? []), { key: '' }] },
        ...afterThisRecord,
      ];

      // This is messing up the order
      setRecords(newRecords);

      reportAppInteraction(
        USER_EVENTS_PAGES.default_columns_config,
        USER_EVENTS_ACTIONS.default_columns_config.add_label
      );
    }
  };

  return (
    <div className={styles.labelContainer}>
      <Button
        disabled={isInvalid}
        tooltip={t(
          'components.app-config.default-columns.add-label.tooltip-label-match-against-query',
          'Add new label to match against user query'
        )}
        variant={'secondary'}
        fill={'outline'}
        icon={'plus'}
        onClick={() => onAddLabel()}
        className={styles.labelContainer__add}
      >
        <Trans i18nKey="components.app-config.default-columns.add-label.add-label">Add label</Trans>
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
  labelContainer__add: css({
    // borderColor: invalid ? theme.colors.error.border : theme.colors.border.strong,
  }),
});
