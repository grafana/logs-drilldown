/* eslint-disable sort/imports */
import { t } from '@grafana/i18n';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { LoadingPlaceholder } from '@grafana/ui';

import { DefaultLabel } from 'services/api';
import { logger } from 'services/logger';
import { getRTKQErrorContext, narrowRTKQError } from 'services/narrowing';
import {
  useCreateLogsDrilldownDefaultLabelsMutation,
  useGetLogsDrilldownDefaultLabelsQuery,
  useReplaceLogsDrilldownDefaultLabelsMutation,
} from '@grafana/api-clients/rtkq/logsdrilldown/v1beta1';

type ServiceSelectionContextType = {
  currentDefaultLabels: DefaultLabel[];
  dsUID: string;
  hasUnsavedChanges: boolean;
  newDefaultLabels: DefaultLabel[] | null;
  reset: () => void;
  save: () => void;
  setDsUID: (dsUID: string) => void;
  setNewDefaultLabels: (labels: DefaultLabel[]) => void;
};

const Context = createContext<ServiceSelectionContextType>({
  currentDefaultLabels: [],
  dsUID: '',
  hasUnsavedChanges: false,
  newDefaultLabels: null,
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
  const [newDefaultLabels, setNewDefaultLabels] = useState<DefaultLabel[] | null>(null);

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
      logger.error(
        new Error(`DefaultLabels::${createError ? 'createNewRecord' : 'updateRecord'}`),
        getRTKQErrorContext(error)
      );
    }
  }, [createError, updateError]);

  const createNewRecord = useMemo(() => {
    const processedError = narrowRTKQError(fetchError);
    return processedError?.status === 404;
  }, [fetchError]);

  const handleSetDsUID = useCallback((dsUID: string) => {
    setDsUID(dsUID);
    setNewDefaultLabels(null);
  }, []);

  const currentDefaultLabels = useMemo(() => {
    if (!isSuccess || !data) {
      return [];
    }

    return data?.spec?.records ?? [];
  }, [data, isSuccess]);

  const reset = useCallback(() => {
    setNewDefaultLabels(null);
  }, []);

  const save = useCallback(() => {
    if (newDefaultLabels === null) {
      throw new Error('DefaultLabelsSave: No labels to save');
    }
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
            records: newDefaultLabels,
          },
        },
      });
    } else {
      if (!data) {
        throw new Error('DefaultLabelsSave: Failed to fetch');
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
            records: newDefaultLabels,
          },
        },
      });
    }
    reset();
  }, [create, createNewRecord, data, dsUID, newDefaultLabels, reset, update]);

  return (
    <Context.Provider
      value={{
        currentDefaultLabels,
        dsUID,
        hasUnsavedChanges: newDefaultLabels !== null,
        newDefaultLabels,
        reset,
        save,
        setNewDefaultLabels,
        setDsUID: handleSetDsUID,
      }}
    >
      {isLoading ? (
        <LoadingPlaceholder text={t('components.app-config.service-selection.context.text-loading', 'Loading...')} />
      ) : (
        children
      )}
    </Context.Provider>
  );
};

export const useServiceSelectionContext = () => {
  return useContext(Context);
};
