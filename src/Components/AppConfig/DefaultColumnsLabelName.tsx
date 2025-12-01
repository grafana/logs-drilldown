import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { DataSourceWithBackend, getDataSourceSrv } from '@grafana/runtime';
import { Combobox, useStyles2 } from '@grafana/ui';
import { ComboboxOption } from '@grafana/ui/dist/types/components/Combobox/types';

import { DetectedLabelsResponse } from '../../services/fields';
import { logger } from '../../services/logger';
import { LokiDatasource } from '../../services/lokiQuery';
import { PLUGIN_ID } from '../../services/plugin';
import { useDefaultColumnsContext } from './DefaultColumnsContext';

interface ValueProps {
  currentLabel: string;
  labelIndex: number;
  recordIndex: number;
}

export const DefaultColumnsLabelName = ({ currentLabel, recordIndex, labelIndex }: ValueProps) => {
  const { dsUID, setLocalDefaultColumnsDatasourceState, localDefaultColumnsState } = useDefaultColumnsContext();
  const styles = useStyles2(getStyles);

  const getLabels = async (): Promise<ComboboxOption[]> => {
    const datasource_ = await getDataSourceSrv().get(dsUID);
    if (!(datasource_ instanceof DataSourceWithBackend)) {
      logger.error(new Error('getTagValuesProvider: Invalid datasource!'));
      throw new Error('Invalid datasource!');
    }
    const datasource = datasource_ as LokiDatasource;
    if (!datasource || !datasource.getResource) {
      throw new Error('Datasource not found');
    }
    const results = await datasource
      .getResource<DetectedLabelsResponse>(
        'detected_labels',
        {},
        {
          headers: {
            'X-Query-Tags': `Source=${PLUGIN_ID}`,
          },
          requestId: 'detected_labels',
        }
      )
      .then((detectedLabelsResult) => {
        console.log('detectedLabelsResult', detectedLabelsResult);
        return detectedLabelsResult;
      })
      .catch((err) => {
        logger.error(err, { msg: 'DefaultColumnsValues:: detected_labels error!' });
        throw err;
      });

    return results.detectedLabels.map((label) => ({ value: label.label }));
  };

  const onSelectFieldName = (labelName: string) => {
    if (localDefaultColumnsState && localDefaultColumnsState[dsUID]) {
      const ds = localDefaultColumnsState[dsUID];
      const records = ds.records;
      const recordToUpdate = records[recordIndex];
      const labelToUpdate = recordToUpdate.labels[labelIndex];
      labelToUpdate.key = labelName;
      labelToUpdate.value = undefined;

      setLocalDefaultColumnsDatasourceState({ ...ds, records });
    }
  };

  return (
    <div className={styles.valuesFieldsContainer}>
      <Combobox<string>
        value={currentLabel}
        invalid={!currentLabel}
        placeholder={'Select label name'}
        width={'auto'}
        minWidth={30}
        maxWidth={90}
        isClearable={false}
        onChange={(fieldName) => onSelectFieldName(fieldName?.value)}
        options={() => getLabels()}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  valuesContainer: css({
    label: 'valuesContainer',
    marginLeft: theme.spacing(2),
    marginBottom: theme.spacing(2),
    marginTop: theme.spacing(1),
  }),
  valueContainer: css({
    label: 'valueContainer',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  }),
  valueContainer__add: css({
    marginTop: theme.spacing(2),
  }),

  valuesFieldsContainer: css({}),
  fieldsContainer: css({ marginLeft: theme.spacing(2) }),
});
