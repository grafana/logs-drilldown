import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';

import { useDefaultColumnsContext } from './Context';
import { DefaultColumnsValidationState } from './types';
import {
  LogsDrilldownDefaultColumnsLogsDefaultColumnsLabel,
  LogsDrilldownDefaultColumnsLogsDefaultColumnsLabels,
  LogsDrilldownDefaultColumnsSpec,
  useCreateLogsDrilldownDefaultColumnsMutation,
  useReplaceLogsDrilldownDefaultColumnsMutation,
} from 'lib/api-clients/logsdrilldown/v1alpha1';
import { logger } from 'services/logger';
import { getRTKQErrorContext, narrowRTKQError } from 'services/narrowing';

export function Submit() {
  const { dsUID, metadata, records, validation } = useDefaultColumnsContext();
  const [create, { error: createError }] = useCreateLogsDrilldownDefaultColumnsMutation();
  const [update, { error: updateError }] = useReplaceLogsDrilldownDefaultColumnsMutation();
  const styles = useStyles2(getStyles, validation.isInvalid);
  const createNewRecord = metadata === null;
  if (!records || !dsUID) {
    return null;
  }

  if (createError) {
    const error = narrowRTKQError(createError);
    logger.error(
      new Error('DefaultColumnsSubmit::createNewRecord'),
      error ? getRTKQErrorContext(error) : { msg: 'DefaultColumnsSubmit:createNewRecord error' }
    );
  }
  if (updateError) {
    const error = narrowRTKQError(updateError);
    logger.error(
      new Error('DefaultColumnsSubmit::updateRecord'),
      error ? getRTKQErrorContext(error) : { msg: 'DefaultColumnsSubmit:updateRecord error' }
    );
  }

  return (
    <Button
      variant={'primary'}
      tooltip={getTooltip(validation)}
      disabled={!validation.hasPendingChanges || validation.isInvalid}
      className={styles.button}
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
      {createNewRecord ? 'Create default columns' : 'Update default columns'}
    </Button>
  );
}

const getStyles = (theme: GrafanaTheme2, isInvalid: boolean) => ({
  button: css({
    borderColor: isInvalid ? theme.colors.error.border : theme.colors.border.strong,
  }),
});

const getTooltip = (validation: DefaultColumnsValidationState): string | undefined => {
  if (!validation.hasPendingChanges) {
    return 'No changes detected';
  }
  if (validation.hasDuplicates) {
    return 'Duplicates detected';
  }
  if (validation.hasInvalidRecords) {
    return 'Invalid records detected';
  }

  return undefined;
};
