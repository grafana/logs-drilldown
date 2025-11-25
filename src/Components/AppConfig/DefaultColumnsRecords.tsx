import React, { useState } from 'react';

import { css } from '@emotion/css';
import { isArray } from 'lodash';

import {
  LogsDrilldownDefaultColumnsLogsDefaultColumnsLabel,
  LogsDrilldownDefaultColumnsLogsDefaultColumnsRecord,
} from '@grafana/api-clients/dist/types/clients/rtkq/logsdrilldown/v1alpha1/endpoints.gen';
import { DataSourceGetTagValuesOptions, GrafanaTheme2 } from '@grafana/data';
import { DataSourceWithBackend, getDataSourceSrv } from '@grafana/runtime';
import { Button, Combobox, useStyles2 } from '@grafana/ui';
import { ComboboxOption } from '@grafana/ui/dist/types/components/Combobox/types';

import { logger } from '../../services/logger';
import { LokiDatasource, LokiQuery } from '../../services/lokiQuery';
import { Values } from './DefaultColumns';
import { useDefaultColumnsContext } from './DefaultColumnsContext';

interface RecordsProps {}

export const DefaultColumnsRecords = ({}: RecordsProps) => {
  const styles = useStyles2(getStyles);
  const { localDefaultColumnsState, dsUID, setLocalDefaultColumnsDatasourceState } = useDefaultColumnsContext();

  if (!localDefaultColumnsState?.[dsUID]) {
    throw new Error('Records::missing localDefaultColumnsState');
  }

  const [pendingLabel, setPendingLabel] = useState(false);

  const getLabelValues = async (labelName: string): Promise<ComboboxOption[]> => {
    console.log('getLabelValues called');
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
        console.log('values', values);
        const returnValues = values.map((metricFindValue) => ({
          value: metricFindValue.text.toString(),
        }));

        console.log('returnValues', returnValues);
        return returnValues;
      }
    }

    return [];
  };

  const onSelectLabelValue = (labelName: string, labelValue: string) => {
    setPendingLabel(false);
  };

  return (
    <div className={styles.labelsContainer}>
      {localDefaultColumnsState[dsUID]?.records.map(
        (record: LogsDrilldownDefaultColumnsLogsDefaultColumnsRecord, recordIndex: number) => {
          return (
            <div key={recordIndex}>
              <div> Record:</div>
              {record.labels?.map((label: LogsDrilldownDefaultColumnsLogsDefaultColumnsLabel, labelIndex: number) => {
                const labelName = label.key;
                const labelValue = label.value;
                return (
                  <div key={labelIndex} className={styles.labelContainer}>
                    <span className={styles.labelContainer__name}>{labelName}</span>

                    <div className={styles.valuesContainer}>
                      <Values label={labelName} value={labelValue} dsUID={dsUID} />
                      {pendingLabel && (
                        <Combobox<string>
                          width={'auto'}
                          minWidth={30}
                          maxWidth={90}
                          isClearable={false}
                          onChange={(labelValue) => onSelectLabelValue(labelName, labelValue?.value)}
                          options={() => getLabelValues(labelName)}
                        />
                      )}
                      <Button
                        disabled={pendingLabel}
                        className={styles.valueContainer__add}
                        variant={'secondary'}
                        fill={'outline'}
                        aria-label={`Add ${labelName} label`}
                        icon={'plus'}
                        onClick={() => setPendingLabel(true)}
                      >
                        Add {labelName}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        }
      )}
      <div>
        <Button
          variant={'secondary'}
          fill={'outline'}
          onClick={() => {
            const result = localDefaultColumnsState[dsUID];
            // @todo set record or something else
            setLocalDefaultColumnsDatasourceState({
              // records: [...(result?.records ?? []), { columns: undefined, labels: undefined }],
              records: [...(result?.records ?? [])],
            });
          }}
        >
          Add record
        </Button>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  marginTop: css`
    margin-top: ${theme.spacing(3)};
  `,
  deleteDatasourceButton: css({
    marginLeft: theme.spacing(2),
  }),
  container: css({
    border: `1px solid ${theme.colors.border.weak}`,
    paddingLeft: theme.spacing(2),
  }),
  labelContainer: css({
    label: 'labelContainer',
    display: 'flex',
    flexDirection: 'column',
    marginLeft: theme.spacing(2),
    marginTop: theme.spacing(1),
  }),
  labelContainer__add: css({
    marginLeft: theme.spacing(2),
  }),
  labelContainer__name: css({}),

  labelsContainer: css({
    label: 'labelsContainer',
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    border: `1px solid ${theme.colors.border.weak}`,
  }),
  datasource: css({
    display: 'flex',
  }),
  datasourceContainer: css({
    label: 'datasourceContainer',
    marginLeft: theme.spacing(2),
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    paddingTop: theme.spacing(2),
    paddingLeft: theme.spacing(2),
    border: `1px solid ${theme.colors.border.weak}`,
  }),

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
  valueContainer__name: css({}),
  valueContainer__remove: css({
    marginLeft: theme.spacing(1),
  }),
  valueContainer__add: css({
    marginTop: theme.spacing(2),
  }),

  valuesFieldsContainer: css({
    label: 'valuesFieldsContainer',
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    paddingLeft: theme.spacing(2),
    border: `1px solid ${theme.colors.border.weak}`,
  }),
  fieldsContainer: css({ marginLeft: theme.spacing(2) }),
});
