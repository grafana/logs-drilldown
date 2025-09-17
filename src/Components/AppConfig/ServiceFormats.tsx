import { DataSourcePicker, DataSourceWithBackend, getDataSourceSrv } from '@grafana/runtime';
import React, { useState } from 'react';
import { AppConfigState } from './AppConfig';
import { Button, Combobox, Field, IconButton, useStyles2 } from '@grafana/ui';
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

interface Props {
  state: AppConfigState;
  setState: (state: AppConfigState) => void;
}

export const ServiceFormats = ({ state, setState }: Props) => {
  const styles = useStyles2(getStyles);

  const newDatasource = () => {
    const newState = state.serviceSelectionFormat;
    newState[''] = {};
    setState({ ...state, serviceSelectionFormat: newState });
  };

  const onChangeDatasource = (ds: DataSourceInstanceSettings, key: string | '') => {
    const newState = state.serviceSelectionFormat;
    if (key === '') {
      delete newState[''];
    }
    setState({
      ...state,
      serviceSelectionFormat: {
        ...newState,
        [ds.uid]: { ...state.serviceSelectionFormat?.[ds.uid] },
      },
    });
  };

  const onDeleteDatasource = (key: string) => {
    const newState = state.serviceSelectionFormat;
    delete newState[key];
    setState({
      ...state,
      serviceSelectionFormat: newState,
    });
  };

  const onAddLabelName = (dsUID: string, labelName: string) => {};
  const onAddLabelValue = (dsUID: string, labelName: string, labelValue: string) => {
    const newState = state.serviceSelectionFormat;
    setState({
      ...state,
      serviceSelectionFormat: {
        ...newState,
        dsUID: {
          ...newState[dsUID],
          [labelName]: {
            [labelValue]: {
              ...newState[dsUID][labelName][labelValue],
            },
          },
        },
      },
    });
  };

  const dsUIDs = Object.keys(state.serviceSelectionFormat);

  return (
    <section>
      <pre>{JSON.stringify(state)}</pre>

      <p>Configure default fields to display instead of the full log line:</p>
      <div className={styles.container}>
        {dsUIDs.map((dsUID) => {
          const labels = state.serviceSelectionFormat[dsUID];

          // @todo don't hardcode service_name
          const labelNames = ['service_name'] ?? Object.keys(labels);

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

              <Labels labelNames={labelNames} state={state} setState={setState} dsUID={dsUID} />
            </div>
          );
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
  labelNames: string[];
  state: AppConfigState;
  setState: (state: AppConfigState) => void;
  dsUID: string;
}

export const Labels = ({ labelNames, state, setState, dsUID }: LabelsProps) => {
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
    const newState = state.serviceSelectionFormat;
    const newLabel = {
      [labelName]: {
        ...newState[dsUID][labelName],
        [labelValue]: {
          ...newState[dsUID]?.[labelName]?.[labelValue],
        },
      },
    };
    setState({
      ...state,
      serviceSelectionFormat: {
        ...newState,
        [dsUID]: {
          ...newState[dsUID],
          ...newLabel,
        },
      },
    });
    setPendingLabel(false);
  };

  return (
    <div className={styles.labelsContainer}>
      {labelNames.map((labelName) => {
        const values = state.serviceSelectionFormat[dsUID][labelName] ?? {};
        const labelValues = Object.keys(values);
        return (
          <div className={styles.labelContainer}>
            <span className={styles.labelContainer__name}>{labelName}</span>

            <div className={styles.valuesContainer}>
              {labelValues.map((value) => (
                <Values state={state} setState={setState} label={labelName} value={value} dsUID={dsUID} />
              ))}
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
    const newState = state.serviceSelectionFormat;
    delete newState[dsUID][labelName][labelValue];
    setState({
      ...state,
      serviceSelectionFormat: newState,
    });
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

      // const getResourceFn = ;

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
    }

    return [{ value: '@todo' }];
  };
  const onSelectFieldName = (labelName: string, labelValue: string) => {
    const newState = state.serviceSelectionFormat;
    const newLabel = {
      [labelName]: {
        ...newState[dsUID][labelName],
        [labelValue]: {
          ...newState[dsUID]?.[labelName]?.[labelValue],
        },
      },
    };
    setState({
      ...state,
      serviceSelectionFormat: {
        ...newState,
        [dsUID]: {
          ...newState[dsUID],
          ...newLabel,
        },
      },
    });
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
