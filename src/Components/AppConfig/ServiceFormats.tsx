import { DataSourcePicker, DataSourceWithBackend, getDataSourceSrv } from '@grafana/runtime';
import React, { useEffect, useState } from 'react';
import { AppConfigState } from './AppConfig';
import { Button, Combobox, ErrorWithStack, Field, IconButton, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { DataSourceGetTagValuesOptions, DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { ComboboxOption } from '@grafana/ui/dist/types/components/Combobox/types';
import { logger } from '../../services/logger';
import { LokiDatasource, LokiQuery } from '../../services/lokiQuery';
import { isArray } from 'lodash';
import { getDetectedFieldsFn } from '../../services/TagKeysProviders';
import { DETECTED_FIELDS_MIXED_FORMAT_EXPR_NO_JSON_FIELDS } from '../../services/variables';
import { DetectedLabelsResponse } from '../../services/fields';
import { PLUGIN_ID } from '../../services/plugin';
import {
  getAPIBaseURL,
  getAPINamespace,
  useGetLogsDrilldownDefaultColumnsQuery,
  useListLogsDrilldownDefaultColumnsQuery,
} from '@grafana/api-clients';
import {
  LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords,
  LogsDrilldownDefaultColumnsSpec,
} from '@grafana/api-clients/dist/types/clients/rtkq/logsdrilldown/v1alpha1/endpoints.gen';

interface Props {
  state: AppConfigState;
  setState: (state: AppConfigState) => void;
}

// @todo move to new tab?
export const ServiceFormats = ({ state, setState }: Props) => {
  const styles = useStyles2(getStyles);

  const newDatasource = () => {
    const newState = state.defaultColumns;

    setState({ ...state, defaultColumns: newState });
  };

  const onChangeDatasource = (ds: DataSourceInstanceSettings, key: string | '') => {
    setState({
      ...state,
      defaultColumnsState: {
        activeDataSource: ds.uid,
      },
    });
  };

  const onDeleteDatasource = (key: string) => {
    console.log('onDeleteDatasource', key);
  };

  console.log('getAPIBaseURL', getAPIBaseURL('logsdrilldown', 'v1alpha1'));
  console.log('getAPINamespace', getAPINamespace());
  const {
    currentData: defaultColumnsFromAPI,
    error: logsDrilldownError,
    isLoading,
  } = useListLogsDrilldownDefaultColumnsQuery({});

  console.log('logsDrilldownData', defaultColumnsFromAPI);
  console.log('defaultColumnsFromAPI.items', defaultColumnsFromAPI?.items);
  console.log('useGetLogsDrilldownDefaultColumnsQuery', useGetLogsDrilldownDefaultColumnsQuery);

  useEffect(() => {
    if (defaultColumnsFromAPI) {
      console.log('LogsDrilldown API Response:', defaultColumnsFromAPI);
    }
    if (logsDrilldownError) {
      console.error('LogsDrilldown API Error:', logsDrilldownError);
    }
  }, [defaultColumnsFromAPI, logsDrilldownError]);

  if (isLoading) {
    return <LoadingPlaceholder text={'Loading...'} />;
  }

  if (logsDrilldownError) {
    return (
      //@todo something better
      <ErrorWithStack
        //@ts-expect-error
        title={logsDrilldownError?.name ?? 'Error getting default columns'}
        //@ts-expect-error
        error={logsDrilldownErro?.message}
        //@ts-expect-error
        errorInfo={logsDrilldownError?.stack}
      />
    );
  }

  if (!defaultColumnsFromAPI) {
    throw new Error('Unexpected result for defaultColumnsFromAPI');
  }

  // @todo create Record<dsUID, [{}]> instead
  const dsUIDRecord: Record<string, LogsDrilldownDefaultColumnsSpec[]> = {};
  defaultColumnsFromAPI.items.forEach((ds) => {
    if (!ds.metadata.name) {
      throw new Error('Unexpected result for defaultColumnsFromAPI: missing metadata name');
    }
    if (dsUIDRecord[ds.metadata.name]) {
      dsUIDRecord[ds.metadata.name].push(ds.spec);
    } else {
      dsUIDRecord[ds.metadata.name] = [ds.spec];
    }
  });

  const dsUIDs = Object.keys(dsUIDRecord);

  return (
    <section>
      {/* @todo remove debug */}
      <pre>{JSON.stringify(defaultColumnsFromAPI)}</pre>

      <p>Configure default fields to display instead of the full log line:</p>
      <div className={styles.container}>
        {dsUIDs.map((dsUID) => {
          const dsRecords = dsUIDRecord[dsUID];

          if (dsRecords?.length) {
            return (
              <div className={styles.datasourceContainer}>
                <div className={styles.datasource}>
                  <DataSourcePicker
                    width={60}
                    filter={(ds) => ds.type === 'loki' && !dsUIDs.includes(ds.uid)}
                    current={dsUID !== '' ? dsUID : null}
                    onChange={(ds) => onChangeDatasource(ds, dsUID)}
                  />
                  <IconButton
                    className={styles.deleteDatasourceButton}
                    variant={'destructive'}
                    aria-label={'Remove datasource config'}
                    name={'minus'}
                    size={'lg'}
                    onClick={() => onDeleteDatasource(dsUID)}
                  />
                </div>

                <Records dsRecords={dsRecords} state={state} setState={setState} dsUID={dsUID} />
              </div>
            );
          } else {
            return <Button>Add record @TODO</Button>;
          }
        })}
        <Field className={styles.marginTop}>
          <Button onClick={newDatasource} variant={'secondary'}>
            Add datasource
          </Button>
        </Field>
      </div>
    </section>
  );
};

interface LabelsProps {
  dsRecords: LogsDrilldownDefaultColumnsSpec[];
  state: AppConfigState;
  setState: (state: AppConfigState) => void;
  dsUID: string;
}

export const Records = ({ dsRecords, state, setState, dsUID }: LabelsProps) => {
  const styles = useStyles2(getStyles);
  const [pendingLabel, setPendingLabel] = useState(false);

  const getLabelValues = async (labelName: string): Promise<Array<ComboboxOption>> => {
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
    // const newState = state.defaultColumns;
    // @todo
    // const newLabel = {
    //   [labelName]: {
    //     ...newState[dsUID][labelName],
    //     [labelValue]: {
    //       ...newState[dsUID]?.[labelName]?.[labelValue],
    //     },
    //   },
    // };
    // setState({
    //   ...state,
    //   defaultColumns: {
    //     ...newState,
    //     [dsUID]: {
    //       ...newState[dsUID],
    //       ...newLabel,
    //     },
    //   },
    // });
    setPendingLabel(false);
  };

  return (
    <div className={styles.labelsContainer}>
      {dsRecords.map((records: LogsDrilldownDefaultColumnsSpec, recordIndex: number) => {
        return (
          <div key={recordIndex}>
            <div> Record: </div>
            {records.records?.map((record: LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords) => {
              return record.labels.map((label, labelIndex: number) => {
                const labelName = label.key;
                const labelValue = label.value;
                return (
                  <div key={labelIndex} className={styles.labelContainer}>
                    <span className={styles.labelContainer__name}>{labelName}</span>

                    <div className={styles.valuesContainer}>
                      <Values state={state} setState={setState} label={labelName} value={labelValue} dsUID={dsUID} />
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
              });
            })}
          </div>
        );
      })}
    </div>
  );
};

interface ValueProps {
  value: string;
  label: string;
  dsUID: string;
  state: AppConfigState;
  setState: (state: AppConfigState) => void;
}
export const Values = ({ value, label, dsUID, state, setState }: ValueProps) => {
  const styles = useStyles2(getStyles);
  const [pendingValue, setPendingValue] = useState(false);

  const onRemoveLabelValue = (labelName: string, labelValue: string) => {
    //@todo
    // const newState = state.defaultColumns;
    // delete newState[dsUID][labelName][labelValue];
    // setState({
    //   ...state,
    //   defaultColumns: newState,
    // });
  };

  const getFieldValues = async (labelName: string, labelValue: string): Promise<Array<ComboboxOption>> => {
    const datasource_ = await getDataSourceSrv().get(dsUID);
    if (!(datasource_ instanceof DataSourceWithBackend)) {
      logger.error(new Error('getTagValuesProvider: Invalid datasource!'));
      throw new Error('Invalid datasource!');
    }
    const datasource = datasource_ as LokiDatasource;
    if (datasource) {
      const expr = `{${labelName}="${labelValue}"}`;
      const detectedFieldsFn = getDetectedFieldsFn(datasource);

      // @todo map results to combobox input
      const results = await Promise.all([
        datasource
          .getResource<DetectedLabelsResponse>(
            'detected_labels',
            {
              // end: request.range.to.utc().toISOString(),
              query: expr,
              // start: request.range.from.utc().toISOString(),
            },
            {
              headers: {
                'X-Query-Tags': `Source=${PLUGIN_ID}`,
              },
              requestId: 'detected_labels',
            }
          )
          .then((detectedLabelsResult) => {
            console.log('detectedLabelsResult', detectedLabelsResult);
            // {
            //   detectedLabels: [
            //     {
            //       label: 'namespace',
            //       cardinality: 1,
            //     },
            //     {
            //       label: 'level',
            //       cardinality: 4,
            //     },
            //   ],
            // }
            return detectedLabelsResult;
          }),
        detectedFieldsFn({
          expr: `${expr} ${DETECTED_FIELDS_MIXED_FORMAT_EXPR_NO_JSON_FIELDS}`,
        }).then((detectedFieldsResult) => {
          console.log('detectedFieldsResult', detectedFieldsResult);
          // [
          //   {
          //     "label": "pod",
          //     "type": "string",
          //     "cardinality": 24,
          //     "parsers": null
          //   },
          //   {
          //     "label": "detected_level",
          //     "type": "string",
          //     "cardinality": 4,
          //     "parsers": null
          //   },
          // ]
        }),
      ]);
      console.log('getFieldValues', results);
    }

    return [{ value: '@todo' }];
  };
  const onSelectFieldName = (labelName: string, labelValue: string) => {
    console.log('onSelectFieldName @TODO');
    // const newState = state.defaultColumns;
    // const newLabel = {
    //   [labelName]: {
    //     ...newState[dsUID][labelName],
    //     [labelValue]: {
    //       ...newState[dsUID]?.[labelName]?.[labelValue],
    //     },
    //   },
    // };
    // setState({
    //   ...state,
    //   defaultColumns: {
    //     ...newState,
    //     [dsUID]: {
    //       ...newState[dsUID],
    //       ...newLabel,
    //     },
    //   },
    // });
    setPendingValue(false);
  };

  return (
    <div className={styles.valuesFieldsContainer}>
      <div className={styles.valueContainer}>
        <span className={styles.valueContainer__name}>{value}</span>
        <IconButton
          disabled={pendingValue}
          variant={'destructive'}
          tooltip={`Remove ${value} label`}
          name={'minus'}
          size={'lg'}
          className={styles.valueContainer__remove}
          onClick={() => onRemoveLabelValue(label, value)}
        />
      </div>

      {pendingValue && (
        <Combobox<string>
          width={'auto'}
          minWidth={30}
          maxWidth={90}
          isClearable={false}
          onChange={(fieldName) => onSelectFieldName(label, fieldName?.value)}
          options={() => getFieldValues(label, value)}
        />
      )}

      <Button
        variant={'secondary'}
        fill={'outline'}
        aria-label={`Add ${value} field`}
        icon={'plus'}
        onClick={() => setPendingValue(true)}
        className={styles.fieldsContainer}
      >
        Add {value} field
      </Button>
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
