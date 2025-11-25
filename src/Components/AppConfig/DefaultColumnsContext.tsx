import React, { createContext, ReactNode, useCallback, useContext, useState } from 'react';

import { LogsDrilldownDefaultColumnsSpec } from '@grafana/api-clients/dist/types/clients/rtkq/logsdrilldown/v1alpha1/endpoints.gen';

type dsUID = string;
export type DefaultColumnsState = Record<dsUID, LogsDrilldownDefaultColumnsSpec>;
export type LocalDefaultColumnsState = Record<dsUID, LogsDrilldownDefaultColumnsSpec | undefined>;

type DefaultColumnsContextType = {
  apiDefaultColumnsState?: DefaultColumnsState | null;
  dsUID: string;
  localDefaultColumnsState?: LocalDefaultColumnsState | null;
  setApiDefaultColumnsState: (defaultColumnsState: DefaultColumnsState) => void;
  setDsUID: (dsUID: string) => void;
  setLocalDefaultColumnsDatasourceState: (localDefaultColumnsState?: LogsDrilldownDefaultColumnsSpec) => void;
};

const DefaultColumnsContext = createContext<DefaultColumnsContextType>({
  dsUID: '',
  setDsUID: () => undefined,
  localDefaultColumnsState: undefined,
  apiDefaultColumnsState: undefined,
  setApiDefaultColumnsState: () => undefined,
  setLocalDefaultColumnsDatasourceState: () => undefined,
});

interface Props {
  children: ReactNode;
  initialDSUID: string;
}
export const DefaultColumnsContextProvider = ({ children, initialDSUID }: Props) => {
  const [localDefaultColumnsState, setLocalDefaultColumnsState] = useState<LocalDefaultColumnsState | null>(null);
  const [apiDefaultColumnsState, setApiDefaultColumnsState] = useState<DefaultColumnsState | null>(null);
  const [dsUID, setDsUID] = useState(initialDSUID);

  const handleSetDsUID = useCallback((dsUID: string) => {
    setDsUID(dsUID);
    setApiDefaultColumnsState(null);
    setLocalDefaultColumnsState(null);
  }, []);

  /**
   * Sets the entire app state
   */
  const handleSetLocalDefaultColumnsState = useCallback((state: LocalDefaultColumnsState) => {
    setLocalDefaultColumnsState(state);
  }, []);

  /**
   * Sets the API response to app state
   */
  const handleSetApiDefaultColumnsState = useCallback(
    (state: DefaultColumnsState) => {
      // Init local state with API response
      if (localDefaultColumnsState === null) {
        handleSetLocalDefaultColumnsState(state);
      }
      setApiDefaultColumnsState(state);
    },
    [handleSetLocalDefaultColumnsState, localDefaultColumnsState]
  );

  /**
   * Sets the state of a single data source
   */
  const handleSetLocalDefaultColumnsDatasourceState = useCallback(
    (state?: LogsDrilldownDefaultColumnsSpec) => {
      const newState = { ...localDefaultColumnsState, [dsUID ?? '']: state };
      setLocalDefaultColumnsState(newState);
    },
    [dsUID, localDefaultColumnsState]
  );

  return (
    <DefaultColumnsContext.Provider
      value={{
        dsUID,
        setDsUID: handleSetDsUID,
        apiDefaultColumnsState,
        localDefaultColumnsState,
        // setLocalDefaultColumnsState: handleSetLocalDefaultColumnsState,
        setApiDefaultColumnsState: handleSetApiDefaultColumnsState,
        setLocalDefaultColumnsDatasourceState: handleSetLocalDefaultColumnsDatasourceState,
      }}
    >
      {children}
    </DefaultColumnsContext.Provider>
  );
};

export const useDefaultColumnsContext = () => {
  return useContext(DefaultColumnsContext);
};
