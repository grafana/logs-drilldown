import React from 'react';

import { Button } from '@grafana/ui';

import { useDefaultColumnsContext } from './DefaultColumnsContext';

export function DefaultColumnsAddRecord() {
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
      }}
    >
      Add
    </Button>
  );
}
