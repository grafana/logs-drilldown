import React, { useCallback } from 'react';

import {
  LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords,
  useCreateLogsDrilldownDefaultColumnsMutation,
} from '@grafana/api-clients';
import { LogsDrilldownDefaultColumnsSpec } from '@grafana/api-clients/dist/types/clients/rtkq/logsdrilldown/v1alpha1/endpoints.gen';
import { Button, Icon, LoadingPlaceholder } from '@grafana/ui';

import { areArraysEqual } from '../../services/comparison';
import { useDefaultColumnsContext } from './DefaultColumnsContext';

export function DefaultColumnsSubmit() {
  const { localDefaultColumnsState, apiDefaultColumnsState, dsUID } = useDefaultColumnsContext();

  const [update, { isLoading, reset, error }] = useCreateLogsDrilldownDefaultColumnsMutation();
  console.log('mutate', update);
  console.log('localDefaultColumnsState', localDefaultColumnsState);
  console.log('error', error);

  const isChanged = useCallback(() => {
    return (
      localDefaultColumnsState &&
      Object.keys(localDefaultColumnsState).some((key) => {
        const lhs: LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords | undefined =
          localDefaultColumnsState?.[key]?.records;
        const rhs: LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords | undefined =
          apiDefaultColumnsState?.[key]?.records;
        return !(lhs && rhs && areArraysEqual(lhs, rhs));
      })
    );
  }, [localDefaultColumnsState, apiDefaultColumnsState]);

  return (
    <Button
      variant={'primary'}
      disabled={!localDefaultColumnsState || !isChanged() || !dsUID}
      onClick={() => {
        if (dsUID && localDefaultColumnsState && localDefaultColumnsState[dsUID]) {
          const updated: LogsDrilldownDefaultColumnsSpec = {
            records: localDefaultColumnsState[dsUID].records,
          };
          update({
            dryRun: 'All',
            pretty: 'true',

            logsDrilldownDefaultColumns: {
              metadata: {
                name: dsUID,
              },
              apiVersion: 'logsdrilldown.grafana.app/v1alpha1',
              kind: 'LogsDrilldownDefaultColumns',
              spec: updated,
            },
          });
        }
      }}
    >
      Save changes {isLoading ? <LoadingPlaceholder text={<Icon name={'spinner'} />} onClick={reset} /> : null}
    </Button>
  );
}
