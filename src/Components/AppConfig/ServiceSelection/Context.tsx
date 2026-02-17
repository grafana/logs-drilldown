import React, { createContext, ReactNode, useCallback, useContext, useState } from 'react';

import { LoadingPlaceholder } from '@grafana/ui';

import {
  LogsDrilldownDefaultLabels,
  useGetLogsDrilldownDefaultLabelsQuery,
} from 'lib/api-clients/logsdrilldown/v1beta1';

type ServiceSelectionContextType = {
  data: LogsDrilldownDefaultLabels | undefined;
  dsUID: string;
  setDsUID: (dsUID: string) => void;
};

const Context = createContext<ServiceSelectionContextType>({
  dsUID: '',
  setDsUID: () => {},
  data: undefined,
});

interface Props {
  children: ReactNode;
  initialDSUID: string;
}

export const ServiceSelectionContextProvider = ({ children, initialDSUID }: Props) => {
  const [dsUID, setDsUID] = useState(initialDSUID);

  const {
    currentData: data,
    //error,
    isLoading,
  } = useGetLogsDrilldownDefaultLabelsQuery({
    name: dsUID,
  });

  /**
   * Sets the datasource UID and clears the existing state
   */
  const handleSetDsUID = useCallback((dsUID: string) => {
    setDsUID(dsUID);
  }, []);

  return (
    <Context.Provider
      value={{
        dsUID,
        setDsUID: handleSetDsUID,
        data,
      }}
    >
      {isLoading ? <LoadingPlaceholder text={'Loading...'} /> : children}
    </Context.Provider>
  );
};

export const useServiceSelectionContext = () => {
  return useContext(Context);
};
