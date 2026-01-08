import React from 'react';

import { Button } from '@grafana/ui';

import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../../services/analytics';
import { useDefaultColumnsContext } from './Context';

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
      Add
    </Button>
  );
}
