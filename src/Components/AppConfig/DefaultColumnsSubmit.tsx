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
  const { dsUID, metadata, records, apiRecords } = useDefaultColumnsContext();
  const [create, { error: createError }] = useCreateLogsDrilldownDefaultColumnsMutation();
  const [update, { error: updateError }] = useReplaceLogsDrilldownDefaultColumnsMutation();
  const createNewRecord = metadata === null;
  if (!records || !dsUID) {
    return null;
  }
  const hasPendingChanges = isDefaultColumnsStateChanged(records, apiRecords);

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
      tooltip={!hasPendingChanges ? 'No changes detected' : undefined}
      disabled={!hasPendingChanges}
      onClick={() => {
        if (dsUID && records) {
          const updated: LogsDrilldownDefaultColumnsSpec = {
            records: records.map((r) => {
              const labels: LogsDrilldownDefaultColumnsLogsDefaultColumnsLabels = r.labels.filter(
                (label): label is LogsDrilldownDefaultColumnsLogsDefaultColumnsLabel => !!label.value && !!label.key
              );
              return {
                labels,
                columns: r.columns,
              };
            }),
          };

          if (createNewRecord) {
            create({
              pretty: 'true',
              logsDrilldownDefaultColumns: {
                metadata: {
                  // name: dsUID,
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
      {createNewRecord ? 'Create default columns' : 'Update default columns'}
    </Button>
  );
}
