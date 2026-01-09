import React from 'react';

import { cloneDeep } from 'lodash';

import { ConfirmButton } from '@grafana/ui';

import { useDefaultColumnsContext } from './Context';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';

export function Undo() {
  const { validation, setRecords, apiRecords } = useDefaultColumnsContext();
  return (
    <ConfirmButton
      onConfirm={() => {
        if (apiRecords !== null) {
          setRecords(cloneDeep(apiRecords));
          reportAppInteraction(
            USER_EVENTS_PAGES.default_columns_config,
            USER_EVENTS_ACTIONS.default_columns_config.undo
          );
        }
      }}
      closeOnConfirm={true}
      confirmText={'Reset'}
      confirmVariant={'destructive'}
      aria-disabled={!validation.hasPendingChanges}
      disabled={!validation.hasPendingChanges}
    >
      Reset
    </ConfirmButton>
  );
}
