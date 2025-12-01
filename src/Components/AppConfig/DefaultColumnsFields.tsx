import { Button, Combobox, ComboboxOption, Icon, Tooltip, useStyles2 } from '@grafana/ui';
import React from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { DataSourceWithBackend, getDataSourceSrv } from '@grafana/runtime';
import { logger } from '../../services/logger';
import { LokiDatasource } from '../../services/lokiQuery';
import { getLabelsKeys } from '../../services/TagKeysProviders';
import { useDefaultColumnsContext } from './DefaultColumnsContext';
import {
  LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsLabels,
  LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecord,
} from './types';
import { LabelFilterOp } from '../../services/filterTypes';
import { AdHocFilterWithLabels } from '@grafana/scenes';
import { LogsDrilldownDefaultColumnsLogsDefaultColumnsLabel } from '@grafana/api-clients';

interface Props {
  recordIndex: number;
}

export function DefaultColumnsFields({ recordIndex }: Props) {
  const styles = useStyles2(getStyles);
  const { localDefaultColumnsState, dsUID, setLocalDefaultColumnsDatasourceState } = useDefaultColumnsContext();
  const record = localDefaultColumnsState?.[dsUID]?.records[recordIndex];
  const columns = record?.columns ?? [];

  if (!record) {
    const error = new Error('DefaultColumnsFields: missing record!');
    logger.error(error, { msg: `DefaultColumnsFields: no record at ${recordIndex} for datasource ${dsUID}` });
    throw error;
  }

  const onSelectColumn = (column: string, columnIndex: number) => {
    if (localDefaultColumnsState && localDefaultColumnsState[dsUID]) {
      const ds = localDefaultColumnsState[dsUID];
      const records = ds.records;
      const recordToUpdate = records[recordIndex];
      recordToUpdate.columns[columnIndex] = column;

      setLocalDefaultColumnsDatasourceState({ ...ds, records: [...(records ?? [])] });
    }
  };

  const getColumns = async () => {
    return await getKeys(dsUID, record.labels);
  };

  return (
    <div className={styles.fieldsContainer}>
      <h5 className={styles.fieldsContainer__title}>
        Display columns
        <Tooltip content={'Default columns to display in logs visualizations'}>
          <Icon name="info-circle" />
        </Tooltip>
      </h5>

      {columns?.map((column, colIdx) => (
        <Combobox<string>
          value={column}
          placeholder={'Select column'}
          width={'auto'}
          minWidth={30}
          maxWidth={90}
          isClearable={false}
          onChange={(column) => onSelectColumn(column?.value, colIdx)}
          options={() => getColumns()}
        />
      ))}

      {/* Add columns @todo */}
      <Button
        tooltip={'Add a default column to display in the logs'}
        variant={'secondary'}
        fill={'outline'}
        aria-label={`Add label`}
        icon={'plus'}
        onClick={() => addDisplayField(record, dsUID)}
        className={styles.fieldsContainer__button}
      >
        Add column
      </Button>
    </div>
  );
}

const addDisplayField = (record: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecord, dsUID: string) => {
  const labels = record.labels;
  const keys = getKeys(dsUID, labels);
  console.log('labels', keys);
};

const getKeys = async (
  dsUID: string,
  columnsLabels: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsLabels
): Promise<ComboboxOption[]> => {
  const datasource_ = await getDataSourceSrv().get(dsUID);
  if (!(datasource_ instanceof DataSourceWithBackend)) {
    logger.error(new Error('DefaultColumnsFields::getFieldValues - Invalid datasource!'));
    throw new Error('DefaultColumnsFields::getFieldValues - Invalid datasource!');
  }
  const datasource = datasource_ as LokiDatasource;
  if (datasource) {
    const labels: AdHocFilterWithLabels[] = columnsLabels
      .filter((label): label is LogsDrilldownDefaultColumnsLogsDefaultColumnsLabel => !!label.value && !!label.key)
      .map((label) => ({
        key: label.key,
        value: label.value,
        operator: LabelFilterOp.Equal,
      }));

    const getLabelsKeysPromise = getLabelsKeys(labels, datasource);
    try {
      const result = await Promise.all([getLabelsKeysPromise]);
      console.log('result', result);
    } catch (e) {
      logger.error(e, { msg: 'DefaultColumnsFields::getLabelsKeys - failed to query Loki labels!' });
    }
    //
    // const expr = labelName && labelValue ? `{${labelName}="${labelValue}"}` : undefined;
    // console.log('expr', expr);
    // const detectedFieldsFn = getDetectedFieldsFn(datasource);
    //
    // const results = await Promise.all([
    //   datasource
    //     .getResource<DetectedLabelsResponse>(
    //       'detected_labels',
    //       {
    //         query: expr,
    //       },
    //       {
    //         headers: {
    //           'X-Query-Tags': `Source=${PLUGIN_ID}`,
    //         },
    //         requestId: 'detected_labels',
    //       }
    //     )
    //     .then((detectedLabelsResult) => {
    //       console.log('detectedLabelsResult', detectedLabelsResult);
    //       return detectedLabelsResult;
    //     }),
    //   detectedFieldsFn({
    //     expr: `${expr} ${DETECTED_FIELDS_MIXED_FORMAT_EXPR_NO_JSON_FIELDS}`,
    //   }).then((detectedFieldsResult) => {
    //     console.log('detectedFieldsResult', detectedFieldsResult);
    //   }),
    // ]);
    // console.log('getFieldValues', results);
  }

  return [{ value: '@todo' }];
};

const getStyles = (theme: GrafanaTheme2) => ({
  fieldsContainer: css({
    label: 'defaultColumnsFields',
  }),
  fieldsContainer__title: css({
    marginTop: theme.spacing(1.5),
    marginLeft: theme.spacing(2),
  }),
  fieldsContainer__button: css({
    alignSelf: 'flex-start',
    marginLeft: theme.spacing(2),
  }),
});
