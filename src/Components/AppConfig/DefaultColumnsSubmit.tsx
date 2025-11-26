import React, { useCallback } from 'react';

import {
  LogsDrilldownDefaultColumnsLogsDefaultColumnsLabel,
  LogsDrilldownDefaultColumnsLogsDefaultColumnsLabels,
  LogsDrilldownDefaultColumnsSpec,
  useCreateLogsDrilldownDefaultColumnsMutation,
} from '@grafana/api-clients';
import { Button, Icon, LoadingPlaceholder } from '@grafana/ui';

import { areArraysEqual } from '../../services/comparison';
import { useDefaultColumnsContext } from './DefaultColumnsContext';
import { LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecords } from './types';

export function DefaultColumnsSubmit() {
  const { localDefaultColumnsState, apiDefaultColumnsState, dsUID } = useDefaultColumnsContext();

  const [update, { isLoading, reset, error }] = useCreateLogsDrilldownDefaultColumnsMutation();
  if (error) {
    console.error('error', error);
  }

  const isChanged = useCallback(() => {
    return (
      localDefaultColumnsState &&
      Object.keys(localDefaultColumnsState).some((key) => {
        const lhs: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecords | undefined =
          localDefaultColumnsState?.[key]?.records;
        const rhs: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecords | undefined =
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
            records: localDefaultColumnsState[dsUID].records.map((r) => {
              const labels: LogsDrilldownDefaultColumnsLogsDefaultColumnsLabels = r.labels.filter(
                (label): label is LogsDrilldownDefaultColumnsLogsDefaultColumnsLabel => !!label.value && !!label.key
              );
              return {
                labels,
                columns: r.columns,
              };
            }),
          };
          update({
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
