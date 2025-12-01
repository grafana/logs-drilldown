import React from 'react';

import { css } from '@emotion/css';
import { isArray } from 'lodash';

import { DataSourceGetTagValuesOptions, GrafanaTheme2 } from '@grafana/data';
import { DataSourceWithBackend, getDataSourceSrv } from '@grafana/runtime';
import { Combobox, ComboboxOption, useStyles2 } from '@grafana/ui';

import { logger } from '../../services/logger';
import { LokiDatasource, LokiQuery } from '../../services/lokiQuery';
import { useDefaultColumnsContext } from './DefaultColumnsContext';

interface Props {
  labelIndex: number;
  labelName: string;
  labelValue?: string;
  recordIndex: number;
}
export function DefaultColumnsLabelValue({ labelValue, labelName, recordIndex, labelIndex }: Props) {
  const { dsUID, localDefaultColumnsState, setLocalDefaultColumnsDatasourceState } = useDefaultColumnsContext();
  const styles = useStyles2(getStyles);

  const onSelectLabelValue = (option: ComboboxOption) => {
    if (localDefaultColumnsState && localDefaultColumnsState[dsUID]) {
      const ds = localDefaultColumnsState[dsUID];
      const records = ds.records;
      const recordToUpdate = records[recordIndex];
      const labelToUpdate = recordToUpdate.labels[labelIndex];
      labelToUpdate.value = option.value;

      setLocalDefaultColumnsDatasourceState({ ...ds, records });
    }
  };

  const getLabelValues = async (labelName: string): Promise<ComboboxOption[]> => {
    const datasource_ = await getDataSourceSrv().get(dsUID);
    if (!(datasource_ instanceof DataSourceWithBackend)) {
      logger.error(new Error('getTagValuesProvider: Invalid datasource!'));
      throw new Error('Invalid datasource!');
    }
    const datasource = datasource_ as LokiDatasource;
    if (datasource && datasource.getTagValues) {
      const options: DataSourceGetTagValuesOptions<LokiQuery> = {
        filters: [],
        key: labelName,
      };
      const values = await datasource.getTagValues(options);
      if (isArray(values)) {
        return values.map((metricFindValue) => ({
          value: metricFindValue.text.toString(),
        }));
      }
    }

    return [];
  };

  return (
    <span className={styles.defaultColumnsLabelValue}>
      <Combobox<string>
        invalid={!labelValue}
        placeholder={'Select label value'}
        width={'auto'}
        minWidth={30}
        value={labelValue}
        maxWidth={90}
        isClearable={false}
        onChange={(opt) => onSelectLabelValue(opt)}
        options={() => getLabelValues(labelName)}
      />
    </span>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  defaultColumnsLabelValue: css({
    label: 'defaultColumnsLabelValue',
    marginLeft: theme.spacing(1),
  }),
});
