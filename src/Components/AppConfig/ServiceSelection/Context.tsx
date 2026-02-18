import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { shallowCompare } from '@grafana/data';
import { LoadingPlaceholder } from '@grafana/ui';

import {
  useCreateLogsDrilldownDefaultLabelsMutation,
  useGetLogsDrilldownDefaultLabelsQuery,
  useReplaceLogsDrilldownDefaultLabelsMutation,
} from 'lib/api-clients/logsdrilldown/v1beta1';
import { logger } from 'services/logger';
import { getRTKQErrorContext, narrowRTKQError } from 'services/narrowing';

type ServiceSelectionContextType = {
  currentDefaultLabels: string[];
  dsUID: string;
  hasUnsavedChanges: boolean;
  newDefaultLabels: string[];
  reset: () => void;
  save: () => void;
  setDsUID: (dsUID: string) => void;
  setNewDefaultLabels: (labels: string[]) => void;
};

const Context = createContext<ServiceSelectionContextType>({
  currentDefaultLabels: [],
  dsUID: '',
  hasUnsavedChanges: false,
  newDefaultLabels: [],
  reset: () => {},
  save: () => {},
  setNewDefaultLabels: () => {},
  setDsUID: () => {},
});

interface Props {
  children: ReactNode;
  initialDSUID: string;
}

export const ServiceSelectionContextProvider = ({ children, initialDSUID }: Props) => {
  const [dsUID, setDsUID] = useState(initialDSUID);
  const [newDefaultLabels, setNewDefaultLabels] = useState<string[]>([]);

  const {
    currentData: data,
    error: fetchError,
    isLoading,
    isSuccess,
  } = useGetLogsDrilldownDefaultLabelsQuery({
    name: dsUID,
  });

  const [create, { error: createError }] = useCreateLogsDrilldownDefaultLabelsMutation();
  const [update, { error: updateError }] = useReplaceLogsDrilldownDefaultLabelsMutation();

  useEffect(() => {
    const error = createError ?? updateError;
    if (error) {
      const error = narrowRTKQError(createError);
      logger.error(
        new Error(`DefaultLabelsSubmit::${createError ? 'createNewRecord' : 'updateRecord'}`),
        error
          ? getRTKQErrorContext(error)
          : { msg: `DefaultColumnsSubmit:${createError ? 'createNewRecord' : 'updateRecord'} error` }
      );
    }
  }, [createError, updateError]);

  const createNewRecord = useMemo(() => {
    const processedError = narrowRTKQError(fetchError);
    return processedError?.status === 404;
  }, [fetchError]);

  const handleSetDsUID = useCallback((dsUID: string) => {
    setDsUID(dsUID);
  }, []);

  const currentDefaultLabels = useMemo(() => {
    if (!isSuccess || !data) {
      return [];
    }

    return data?.spec?.records[0]?.labels ?? [];
  }, [data, isSuccess]);

  const reset = useCallback(() => {
    setNewDefaultLabels([]);
  }, []);

  const save = useCallback(() => {
    if (createNewRecord) {
      create({
        pretty: 'true',
        logsDrilldownDefaultLabels: {
          apiVersion: 'logsdrilldown.grafana.app/v1beta1',
          kind: 'LogsDrilldownDefaultLabels',
          metadata: {
            name: dsUID,
          },
          spec: {
            records: [
              {
                labels: newDefaultLabels,
              },
            ],
          },
        },
      });
    } else {
      if (!data) {
        throw new Error('[Default Labels] Failed to fetch');
      }
      update({
        pretty: 'true',
        name: dsUID,
        logsDrilldownDefaultLabels: {
          apiVersion: 'logsdrilldown.grafana.app/v1beta1',
          kind: 'LogsDrilldownDefaultLabels',
          metadata: {
            name: dsUID,
            resourceVersion: data.metadata.resourceVersion,
          },
          spec: {
            records: [
              {
                labels: newDefaultLabels,
              },
            ],
          },
        },
      });
    }
  }, [create, createNewRecord, data, dsUID, newDefaultLabels, update]);

  return (
    <Context.Provider
      value={{
        currentDefaultLabels,
        dsUID,
        hasUnsavedChanges: !shallowCompare(currentDefaultLabels, newDefaultLabels),
        newDefaultLabels,
        reset,
        save,
        setNewDefaultLabels,
        setDsUID: handleSetDsUID,
      }}
    >
      {isLoading ? <LoadingPlaceholder text={'Loading...'} /> : children}
    </Context.Provider>
  );
};

export const useServiceSelectionContext = () => {
  return useContext(Context);
};
