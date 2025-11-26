import React, { useCallback } from 'react';

import {
  LogsDrilldownDefaultColumnsLogsDefaultColumnsLabel,
  LogsDrilldownDefaultColumnsLogsDefaultColumnsLabels,
  LogsDrilldownDefaultColumnsSpec,
  useCreateLogsDrilldownDefaultColumnsMutation,
  useReplaceLogsDrilldownDefaultColumnsMutation,
} from '@grafana/api-clients';
import { Button } from '@grafana/ui';

import { areArraysEqual } from '../../services/comparison';
import { useDefaultColumnsContext } from './DefaultColumnsContext';
import { LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecords } from './types';

export function DefaultColumnsSubmit() {
  const { localDefaultColumnsState, apiDefaultColumnsState, dsUID, metadata } = useDefaultColumnsContext();

  const [create, { error: createError }] = useCreateLogsDrilldownDefaultColumnsMutation();
  const [update, { error: updateError }] = useReplaceLogsDrilldownDefaultColumnsMutation();
  if (createError) {
    console.error('createError', createError);
  }
  if (updateError) {
    console.error('updateError', updateError);
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

          if (metadata === null) {
            create({
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
          } else {
            update({
              pretty: 'true',
              name: dsUID,
              logsDrilldownDefaultColumns: {
                metadata: {
                  name: dsUID,
                  resourceVersion: metadata.resourceVersion,
                },
                apiVersion: 'logsdrilldown.grafana.app/v1alpha1',
                kind: 'LogsDrilldownDefaultColumns',
                spec: updated,
              },
            });
          }
        }
      }}
    >
      Save changes
    </Button>
  );
}
