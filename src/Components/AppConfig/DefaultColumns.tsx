import React, { useEffect, useState } from 'react';

import { css } from '@emotion/css';

import { useGetLogsDrilldownDefaultColumnsQuery } from '@grafana/api-clients';
import { GrafanaTheme2 } from '@grafana/data';
import { DataSourceWithBackend, getDataSourceSrv } from '@grafana/runtime';
import { Button, Combobox, IconButton, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { ComboboxOption } from '@grafana/ui/dist/types/components/Combobox/types';

import { DetectedLabelsResponse } from '../../services/fields';
import { logger } from '../../services/logger';
import { LokiDatasource } from '../../services/lokiQuery';
import { narrowRTKQError } from '../../services/narrowing';
import { PLUGIN_ID } from '../../services/plugin';
import { getDetectedFieldsFn } from '../../services/TagKeysProviders';
import { DETECTED_FIELDS_MIXED_FORMAT_EXPR_NO_JSON_FIELDS } from '../../services/variables';
import { DefaultColumnsState, useDefaultColumnsContext } from './DefaultColumnsContext';
import { DefaultColumnsRecords } from './DefaultColumnsRecords';

interface Props {}

export const DefaultColumns = ({}: Props) => {
  const styles = useStyles2(getStyles);

  const { localDefaultColumnsState, setApiDefaultColumnsState, dsUID, apiDefaultColumnsState } =
    useDefaultColumnsContext();

  const {
    currentData: defaultColumnsFromAPI,
    error: unknownAPIError,
    isLoading,
  } = useGetLogsDrilldownDefaultColumnsQuery({
    name: dsUID,
  });

  const defaultColumnsAPIError = narrowRTKQError(unknownAPIError);

  useEffect(() => {
    const dsUIDRecord: DefaultColumnsState = {};

    if (isLoading) {
      return;
    }

    if (apiDefaultColumnsState && apiDefaultColumnsState[dsUID]) {
      return;
    }

    // Success
    if (defaultColumnsFromAPI) {
      console.log('LogsDrilldown API Response:', defaultColumnsFromAPI);

      if (!defaultColumnsFromAPI.metadata.name) {
        throw new Error('DefaultColumns::Unexpected result for defaultColumnsFromAPI - missing metadata name');
      }
      if (defaultColumnsFromAPI.metadata.name !== dsUID) {
        throw new Error('DefaultColumns::Unexpected result for defaultColumnsFromAPI - invalid datasource uid');
      }

      dsUIDRecord[defaultColumnsFromAPI.metadata.name] = { records: defaultColumnsFromAPI.spec.records };
      setApiDefaultColumnsState(dsUIDRecord);

      // API error
    } else if (defaultColumnsAPIError) {
      // Expected error
      if (defaultColumnsAPIError.status === 404) {
        setApiDefaultColumnsState({ [dsUID]: { records: [] } });
      } else {
        console.error('LogsDrilldown API Error:', defaultColumnsAPIError);
        throw new Error('DefaultColumns::Unexpected result for default columns - api error');
      }
    } else {
      throw new Error('DefaultColumns::Unexpected result for default columns');
    }
  }, [
    defaultColumnsFromAPI,
    defaultColumnsAPIError,
    isLoading,
    apiDefaultColumnsState,
    dsUID,
    setApiDefaultColumnsState,
  ]);

  if (isLoading || !localDefaultColumnsState || !localDefaultColumnsState[dsUID]) {
    console.log('isLoading', { isLoading, localDefaultColumnsState, dsUID });
    return <LoadingPlaceholder text={'Loading...'} />;
  }

  return (
    <section>
      {/* @todo remove debug */}
      <pre>{JSON.stringify(defaultColumnsFromAPI)}</pre>

      <p>Configure default fields to display instead of the full log line:</p>
      <div className={styles.container}>
        <div className={styles.datasourceContainer}>
          <DefaultColumnsRecords />
        </div>
      </div>
    </section>
  );
};

interface ValueProps {
  dsUID: string;
  label: string;
  value: string;
}

export const Values = ({ value, label, dsUID }: ValueProps) => {
  const styles = useStyles2(getStyles);
  const [pendingValue, setPendingValue] = useState(false);

  const onRemoveLabelValue = (labelName: string, labelValue: string) => {
    console.log('onRemoveLabelValue', { labelValue, labelName });
    //@todo
    // const newState = state.defaultColumns;
    // delete newState[dsUID][labelName][labelValue];
    // setState({
    //   ...state,
    //   defaultColumns: newState,
    // });
  };

  const getFieldValues = async (labelName: string, labelValue: string): Promise<ComboboxOption[]> => {
    const datasource_ = await getDataSourceSrv().get(dsUID);
    if (!(datasource_ instanceof DataSourceWithBackend)) {
      logger.error(new Error('getTagValuesProvider: Invalid datasource!'));
      throw new Error('Invalid datasource!');
    }
    const datasource = datasource_ as LokiDatasource;
    if (datasource) {
      const expr = `{${labelName}="${labelValue}"}`;
      console.log('expr', expr);
      const detectedFieldsFn = getDetectedFieldsFn(datasource);

      const results = await Promise.all([
        datasource
          .getResource<DetectedLabelsResponse>(
            'detected_labels',
            {
              query: expr,
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
            return detectedLabelsResult;
          }),
        detectedFieldsFn({
          expr: `${expr} ${DETECTED_FIELDS_MIXED_FORMAT_EXPR_NO_JSON_FIELDS}`,
        }).then((detectedFieldsResult) => {
          console.log('detectedFieldsResult', detectedFieldsResult);
        }),
      ]);
      console.log('getFieldValues', results);
    }

    return [{ value: '@todo' }];
  };
  const onSelectFieldName = (labelName: string, labelValue: string) => {
    console.log('onSelectFieldName @TODO');
    setPendingValue(false);
  };

  return (
    <div className={styles.valuesFieldsContainer}>
      <div className={styles.valueContainer}>
        <span className={styles.valueContainer__name}>{value}</span>
        <IconButton
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
