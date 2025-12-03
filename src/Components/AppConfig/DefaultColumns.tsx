import React, { useEffect } from 'react';

import { css } from '@emotion/css';

import { useGetLogsDrilldownDefaultColumnsQuery } from '@grafana/api-clients';
import { GrafanaTheme2 } from '@grafana/data';
import { SceneContextProvider } from '@grafana/scenes-react';
import { LoadingPlaceholder, useStyles2 } from '@grafana/ui';

import { narrowRTKQError } from '../../services/narrowing';
import { useDefaultColumnsContext } from './DefaultColumnsContext';
import { DefaultColumnsLogsView } from './DefaultColumnsLogsView';
import { DefaultColumnsRecords } from './DefaultColumnsRecords';
import { DefaultColumnsState } from './types';

interface Props {}

//@todo make sure we don't save duplicate records

export const DefaultColumns = ({}: Props) => {
  const styles = useStyles2(getStyles);

  const { localDefaultColumnsState, setApiDefaultColumnsState, dsUID, apiDefaultColumnsState, setMetadata, metadata } =
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

    // If we've already set this version to local state, don't do it twice
    if (
      apiDefaultColumnsState &&
      apiDefaultColumnsState[dsUID] &&
      defaultColumnsFromAPI?.metadata.resourceVersion === metadata?.resourceVersion
    ) {
      return;
    }

    setMetadata(defaultColumnsFromAPI?.metadata ?? null);

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
    }
  }, [
    metadata?.resourceVersion,
    setMetadata,
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
    <div className={styles.container}>
      <DefaultColumnsRecords />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({}),
});
