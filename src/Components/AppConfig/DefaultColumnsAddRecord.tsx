import React from 'react';

import { Button } from '@grafana/ui';

import { useDefaultColumnsContext } from './DefaultColumnsContext';

export function DefaultColumnsAddRecord() {
  const { setLocalDefaultColumnsDatasourceState, dsUID, localDefaultColumnsState } = useDefaultColumnsContext();
  const ds = localDefaultColumnsState?.[dsUID];

  if (!ds) {
    return null;
  }

  // @todo perf
  const invalidRecords = ds.records.filter(
    (r) =>
      !(
        r.columns.length &&
        r.labels.length &&
        r.labels.every(
          (l) => l.key !== '' //
        ) &&
        r.columns.every((c) => c)
      )
  );

  const isInvalid = !!ds.records.length && !!invalidRecords.length;

  return (
    <Button
      variant={'secondary'}
      fill={'outline'}
      icon={'plus'}
      disabled={isInvalid}
      onClick={() => {
        setLocalDefaultColumnsDatasourceState({
          // Add new record with empty label name
          records: [...(ds?.records ?? []), { columns: [], labels: [{ key: '' }] }],
        });
      }}
    >
      Add record
    </Button>
  );
}
