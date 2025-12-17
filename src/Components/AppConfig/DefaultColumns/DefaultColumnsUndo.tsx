import React from 'react';

import { cloneDeep } from 'lodash';

import { Button } from '@grafana/ui';

import { useDefaultColumnsContext } from './DefaultColumnsContext';

export function DefaultColumnsUndo() {
  const { validation, setRecords, apiRecords } = useDefaultColumnsContext();
  return (
    <Button
      onClick={() => {
        if (apiRecords !== null) {
          setRecords(cloneDeep(apiRecords));
        }
      }}
      variant={'destructive'}
      disabled={!validation.hasPendingChanges}
    >
      Reset
    </Button>
  );
}
