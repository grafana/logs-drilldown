import React from 'react';

import { css } from '@emotion/css';
import { flatten } from 'lodash';

import { GrafanaTheme2 } from '@grafana/data';
import { DataSourceWithBackend, getDataSourceSrv } from '@grafana/runtime';
import { Button, Combobox, ComboboxOption, Icon, IconButton, Tooltip, useStyles2 } from '@grafana/ui';

import { logger } from '../../services/logger';
import { LokiDatasource } from '../../services/lokiQuery';
import { getDetectedFieldsFn, getLabelsKeys } from '../../services/TagKeysProviders';
import { DETECTED_FIELDS_MIXED_FORMAT_EXPR_NO_JSON_FIELDS } from '../../services/variables';
import { useDefaultColumnsContext } from './DefaultColumnsContext';
import { getColumnsLabelsExpr, mapColumnsLabelsToAdHocFilters } from './DefaultColumnsLabelsQueries';
import { LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecord } from './types';

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

      setLocalDefaultColumnsDatasourceState({ records });
    }
  };

  const onRemoveColumn = (columnIndex: number) => {
    if (localDefaultColumnsState && localDefaultColumnsState[dsUID]) {
      const ds = localDefaultColumnsState[dsUID];
      const records = ds.records;
      const recordToUpdate = records[recordIndex];
      recordToUpdate.columns.splice(columnIndex, 1);

      setLocalDefaultColumnsDatasourceState({ records });
    }
  };

  const addDisplayField = () => {
    if (localDefaultColumnsState && localDefaultColumnsState[dsUID]) {
      const ds = localDefaultColumnsState[dsUID];
      const records = ds.records;
      const recordToUpdate = records[recordIndex];
      recordToUpdate.columns = [...recordToUpdate.columns, ''];
      setLocalDefaultColumnsDatasourceState({ records });
    }
  };

  return (
    <div className={styles.fieldsContainer}>
      <h5 className={styles.fieldsContainer__title}>
        Display columns
        <Tooltip content={'Default columns to display in logs visualizations'}>
          <Icon className={styles.fieldsContainer__icon} name="info-circle" />
        </Tooltip>
      </h5>

      {columns?.map((column, colIdx) => (
        <div key={colIdx} className={styles.fieldsContainer__inputContainer}>
          <Combobox<string>
            invalid={!column}
            value={column}
            placeholder={'Select column'}
            width={'auto'}
            minWidth={30}
            isClearable={false}
            onChange={(column) => onSelectColumn(column?.value, colIdx)}
            createCustomValue={true}
            options={(typeAhead) =>
              getKeys(dsUID, record, colIdx).then((opts) => opts.filter((opt) => opt.value.includes(typeAhead)))
            }
          />
          <IconButton
            variant={'destructive'}
            tooltip={`Remove ${column}`}
            name={'minus'}
            size={'lg'}
            className={styles.fieldsContainer__remove}
            onClick={() => onRemoveColumn(colIdx)}
          />
        </div>
      ))}

      <Button
        tooltip={'Add a default column to display in the logs'}
        variant={'secondary'}
        fill={'outline'}
        aria-label={`Add label`}
        icon={'plus'}
        onClick={() => addDisplayField()}
        className={styles.fieldsContainer__button}
      >
        Add column
      </Button>
    </div>
  );
}

// @todo move
export const getDatasource = async (dsUID: string) => {
  const datasource_ = await getDataSourceSrv().get(dsUID);

  if (!(datasource_ instanceof DataSourceWithBackend)) {
    logger.error(new Error('DefaultColumnsFields::getFieldValues - Invalid datasource!'));
    throw new Error('DefaultColumnsFields::getFieldValues - Invalid datasource!');
  }
  const datasource = datasource_ as LokiDatasource;
  return datasource;
};

const getKeys = async (
  dsUID: string,
  record: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecord,
  colIdx: number
): Promise<ComboboxOption[]> => {
  const datasource = await getDatasource(dsUID);

  if (datasource) {
    // Get labels query
    const labelFilters = mapColumnsLabelsToAdHocFilters(record.labels);
    const getLabelsKeysPromise = getLabelsKeys(labelFilters, datasource);

    // Get fields query
    const getDetectedFieldsKeysFn = getDetectedFieldsFn(datasource);
    const expr = getColumnsLabelsExpr(labelFilters);
    const getDetectedFieldsKeysPromise = expr
      ? getDetectedFieldsKeysFn({
          expr: `{${expr}} ${DETECTED_FIELDS_MIXED_FORMAT_EXPR_NO_JSON_FIELDS}`,
        })
      : Promise.resolve([]);

    try {
      const removeAlreadySelected = (opt: ComboboxOption) => !record.columns.some((col) => col && col === opt.value);
      const column = record.columns[colIdx];
      const combinedRequests: Promise<[ComboboxOption[], ComboboxOption[]]> = Promise.all([
        getLabelsKeysPromise.then((res) => {
          return res
            .map((key) => ({ value: key.text, group: 'Labels' }))
            .filter((opt) => column === opt.value || removeAlreadySelected(opt))
            .sort((l, r) => l.value.localeCompare(r.value));
        }),
        getDetectedFieldsKeysPromise.then((res): ComboboxOption[] => {
          if (res instanceof Error) {
            logger.error(res, { msg: 'DefaultColumnsFields::getKeys - Failed to fetch detected fields' });
            throw res;
          }
          return res
            .map((key) => ({ value: key.label, group: 'Fields' /* dont wrap this line */ }))
            .filter((opt) => column === opt.value || removeAlreadySelected(opt))
            .sort((l, r) => l.value.localeCompare(r.value));
        }),
      ]);
      return combinedRequests.then((reqs): ComboboxOption[] => flatten(reqs));
    } catch (e) {
      logger.error(e, { msg: 'DefaultColumnsFields::getKeys - Failed to fetch labels!' });
      return [];
    }
  }

  return [];
};

const getStyles = (theme: GrafanaTheme2) => ({
  fieldsContainer: css({
    label: 'fieldsContainer',
  }),
  fieldsContainer__icon: css({
    marginLeft: theme.spacing(0.5),
  }),
  fieldsContainer__title: css({
    marginTop: theme.spacing(1.5),
    display: 'flex',
    alignItems: 'center',
  }),
  fieldsContainer__button: css({
    alignSelf: 'flex-start',
    marginTop: theme.spacing(1),
  }),
  fieldsContainer__inputContainer: css({
    marginTop: theme.spacing(1),
    display: 'flex',
  }),
  fieldsContainer__remove: css({
    marginLeft: theme.spacing(1),
  }),
});
