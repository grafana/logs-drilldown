import React, { useEffect } from 'react';

import { LoadingPlaceholder } from '@grafana/ui';

import { useDefaultColumnsContext } from './Context';
import { Records } from './Records';
import { APIColumnsState } from './types';
import { useGetLogsDrilldownDefaultColumnsQuery } from 'lib/api-clients/logsdrilldown/v1beta1';
import { logger } from 'services/logger';
import { getRTKQErrorContext, narrowRTKQError } from 'services/narrowing';

interface Props {}

export const DefaultColumns = ({}: Props) => {
  const { setApiDefaultColumnsState, dsUID, setMetadata, metadata, apiRecords } = useDefaultColumnsContext();
  const {
    currentData: defaultColumnsFromAPI,
    error: unknownAPIError,
    isLoading,
  } = useGetLogsDrilldownDefaultColumnsQuery({
    name: dsUID,
  });

  const defaultColumnsAPIError = narrowRTKQError(unknownAPIError);

  useEffect(() => {
    const dsUIDRecord: APIColumnsState = {};

    if (isLoading) {
      return;
    }

    // If we've already set this version to local state, don't do it twice
    if (
      metadata?.resourceVersion &&
      defaultColumnsFromAPI &&
      defaultColumnsFromAPI?.metadata.resourceVersion === metadata?.resourceVersion
    ) {
      return;
    }

    setMetadata(defaultColumnsFromAPI?.metadata ?? null);

    // Success
    if (defaultColumnsFromAPI) {
      if (!defaultColumnsFromAPI.metadata.name) {
        const error = new Error('DefaultColumns::Unexpected result for defaultColumnsFromAPI - missing metadata name');
        logger.error(error);
        throw error;
      }
      if (defaultColumnsFromAPI.metadata.name !== dsUID) {
        const error = new Error('DefaultColumns::Unexpected result for defaultColumnsFromAPI - invalid datasource uid');
        logger.error(error);
        throw error;
      }

      dsUIDRecord[defaultColumnsFromAPI.metadata.name] = { records: defaultColumnsFromAPI.spec.records };
      setApiDefaultColumnsState(dsUIDRecord);

      // API error
    } else if (defaultColumnsAPIError) {
      // Expected error
      if (defaultColumnsAPIError.status === 404) {
        if (apiRecords === null) {
          setApiDefaultColumnsState({ [dsUID]: { records: [] } });
        }
      } else {
        const error = new Error('DefaultColumns::Unexpected result for default columns - api error');
        logger.error(error, getRTKQErrorContext(defaultColumnsAPIError));
        throw error;
      }
    }
  }, [
    apiRecords,
    metadata?.resourceVersion,
    setMetadata,
    defaultColumnsFromAPI,
    defaultColumnsAPIError,
    isLoading,
    dsUID,
    setApiDefaultColumnsState,
  ]);

  if (isLoading) {
    return <LoadingPlaceholder text={'Loading...'} />;
  }

  return <Records />;
};
