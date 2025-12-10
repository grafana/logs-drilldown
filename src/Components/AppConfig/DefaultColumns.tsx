import React, { useEffect } from 'react';

import { LoadingPlaceholder } from '@grafana/ui';

import { useGetLogsDrilldownDefaultColumnsQuery } from '../../lib/api-clients/logsdrilldown/v1alpha1';
import { logger } from '../../services/logger';
import { narrowRTKQError } from '../../services/narrowing';
import { useDefaultColumnsContext } from './DefaultColumnsContext';
import { DefaultColumnsRecords } from './DefaultColumnsRecords';
import { APIColumnsState } from './types';

interface Props {}

export const DefaultColumns = ({}: Props) => {
  const { setApiDefaultColumnsState, dsUID, setMetadata, metadata } = useDefaultColumnsContext();

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
    if (defaultColumnsFromAPI?.metadata.resourceVersion === metadata?.resourceVersion) {
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
        logger.error('LogsDrilldown API Error:', {
          statusText: defaultColumnsAPIError.statusText ?? '',
          trace: defaultColumnsAPIError.traceId ?? '',
          status: defaultColumnsAPIError.status?.toString() ?? '',
          msg: defaultColumnsAPIError.data?.message ?? '',
        });
        throw new Error('DefaultColumns::Unexpected result for default columns - api error');
      }
    }
  }, [
    metadata?.resourceVersion,
    setMetadata,
    defaultColumnsFromAPI,
    defaultColumnsAPIError,
    isLoading,
    dsUID,
    setApiDefaultColumnsState,
  ]);

  // @todo if grafana 12.4-pre is run and it doesn't have the API changes isLoading is always true and we get stuck in a loading state
  // Shouldn't be a problem as long as we make sure the API changes are deployed to cloud before releasing, unless OSS users are running pre-release versions.
  if (isLoading) {
    return <LoadingPlaceholder text={'Loading...'} />;
  }

  return <DefaultColumnsRecords />;
};
