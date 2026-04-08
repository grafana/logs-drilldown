import React from 'react';

import { Trans } from '@grafana/i18n';
import { Button } from '@grafana/ui';

import { useDefaultColumnsContext } from './Context';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';

export function AddRecord() {
  const { validation, records, setRecords } = useDefaultColumnsContext();

  if (!records) {
    return null;
  }

  return (
    <Button
      variant={'secondary'}
      fill={'outline'}
      icon={'plus'}
      disabled={validation.isInvalid}
      onClick={() => {
        setRecords([...(records ?? []), { columns: [], labels: [{ key: '' }] }]);
        reportAppInteraction(
          USER_EVENTS_PAGES.default_columns_config,
          USER_EVENTS_ACTIONS.default_columns_config.add_record
        );
      }}
    >
      <Trans i18nKey="components.add-record.add">Add</Trans>
    </Button>
  );
}
