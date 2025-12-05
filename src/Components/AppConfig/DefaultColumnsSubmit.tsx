import React from 'react';

import { Button } from '@grafana/ui';

import {
  LogsDrilldownDefaultColumnsLogsDefaultColumnsLabel,
  LogsDrilldownDefaultColumnsLogsDefaultColumnsLabels,
  LogsDrilldownDefaultColumnsSpec,
  useCreateLogsDrilldownDefaultColumnsMutation,
  useReplaceLogsDrilldownDefaultColumnsMutation,
} from '../../lib/api-clients/logsdrilldown/v1alpha1';
import { useDefaultColumnsContext } from './DefaultColumnsContext';
import { isDefaultColumnsStateChanged } from './DefaultColumnsState';

export function DefaultColumnsSubmit() {
  const { localDefaultColumnsState, apiDefaultColumnsState, dsUID, metadata } = useDefaultColumnsContext();
  const [create, { error: createError }] = useCreateLogsDrilldownDefaultColumnsMutation();
  const [update, { error: updateError }] = useReplaceLogsDrilldownDefaultColumnsMutation();

  // @todo logger
  if (createError) {
    console.error('createError', createError);
  }
  if (updateError) {
    console.error('updateError', updateError);
  }

  return (
    <Button
      variant={'primary'}
      disabled={
        !localDefaultColumnsState ||
        !isDefaultColumnsStateChanged(localDefaultColumnsState, apiDefaultColumnsState) ||
        !dsUID
      }
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
