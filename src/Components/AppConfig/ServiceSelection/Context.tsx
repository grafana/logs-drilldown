import React, { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import { LoadingPlaceholder } from '@grafana/ui';

import { useGetLogsDrilldownDefaultLabelsQuery } from 'lib/api-clients/logsdrilldown/v1beta1';

type ServiceSelectionContextType = {
  currentDefaultLabels: string[];
  dsUID: string;
  newDefaultLabels: string[];
  setDsUID: (dsUID: string) => void;
  setNewDefaultLabels: (labels: string[]) => void;
};

const Context = createContext<ServiceSelectionContextType>({
  currentDefaultLabels: [],
  newDefaultLabels: [],
  dsUID: '',
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
    //error,
    isLoading,
    isSuccess,
  } = useGetLogsDrilldownDefaultLabelsQuery({
    name: dsUID,
  });

  const handleSetDsUID = useCallback((dsUID: string) => {
    setDsUID(dsUID);
  }, []);

  const currentDefaultLabels = useMemo(() => {
    if (!isSuccess || !data) {
      return [];
    }

    const record = data?.spec?.records?.find((record) => record.dsUid === dsUID);

    return record?.labels ?? [];
  }, [data, dsUID, isSuccess]);

  return (
    <Context.Provider
      value={{
        currentDefaultLabels,
        newDefaultLabels,
        dsUID,
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
