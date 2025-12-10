import { flatten } from 'lodash';

import { DataSourceWithBackend, getDataSourceSrv } from '@grafana/runtime';
import { ComboboxOption } from '@grafana/ui';

import { LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords } from '../../lib/api-clients/logsdrilldown/v1alpha1';
import { areArraysStrictlyEqual } from '../../services/comparison';
import { logger } from '../../services/logger';
import { LokiDatasource } from '../../services/lokiQuery';
import { getDetectedFieldsFn, getLabelsKeys } from '../../services/TagKeysProviders';
import { DETECTED_FIELDS_MIXED_FORMAT_EXPR_NO_JSON_FIELDS } from '../../services/variables';
import { getColumnsLabelsExpr, mapColumnsLabelsToAdHocFilters } from './DefaultColumnsLabelsQueries';
import {
  LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecord,
  LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecords,
} from './types';

/**
 * Does the local stage have changes that aren't saved in the latest API response?
 * @param records
 * @param apiRecords
 */
export const isDefaultColumnsStateChanged = (
  records: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecords | null,
  apiRecords: LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords | null
) => {
  const lhs: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecords | null = records;
  const rhs: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecords | null = apiRecords;
  return records && !(lhs && rhs && areArraysStrictlyEqual(lhs, rhs));
};

export const getKeys = async (
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

export const getDatasource = async (dsUID: string) => {
  const ds = await getDataSourceSrv().get(dsUID);

  if (!(ds instanceof DataSourceWithBackend)) {
    const err = new Error('DefaultColumnsState::getDatasource - Invalid datasource!');
    logger.error(err);
    throw err;
  }
  return ds as LokiDatasource;
};

/**
 * Determine if any records have the same set of labels
 * @param records
 */
export const recordsHaveDuplicates = (records: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecords) => {
  const set = new Set();

  records.forEach((record) => {
    const labels = record.labels.sort();
    set.add(JSON.stringify(labels));
  });

  return set.size !== records.length;
};
