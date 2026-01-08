import React from 'react';

import { cloneDeep } from 'lodash';

import { ConfirmButton } from '@grafana/ui';

import { useDefaultColumnsContext } from './Context';

export function Undo() {
  const { validation, setRecords, apiRecords } = useDefaultColumnsContext();
  return (
    <ConfirmButton
      onConfirm={() => {
        if (apiRecords !== null) {
          setRecords(cloneDeep(apiRecords));
        }
      }}
      closeOnConfirm={true}
      confirmText={'Reset'}
      confirmVariant={'destructive'}
      disabled={!validation.hasPendingChanges}
    >
      Reset
    </ConfirmButton>
  );
}
