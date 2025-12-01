import React, { createContext, ReactNode, useCallback, useContext, useState } from 'react';

import { cloneDeep } from 'lodash';

import { ObjectMeta } from '@grafana/api-clients';

import { DefaultColumnsState, LocalDefaultColumnsState, LocalLogsDrilldownDefaultColumnsSpec } from './types';

type DefaultColumnsContextType = {
  apiDefaultColumnsState?: DefaultColumnsState | null;
  dsUID: string;
  localDefaultColumnsState?: LocalDefaultColumnsState | null;
  metadata: ObjectMeta | null;
  setApiDefaultColumnsState: (defaultColumnsState: DefaultColumnsState) => void;
  setDsUID: (dsUID: string) => void;
  setLocalDefaultColumnsDatasourceState: (localDefaultColumnsState?: LocalLogsDrilldownDefaultColumnsSpec) => void;
  setMetadata: (m: ObjectMeta | null) => void;
};

const DefaultColumnsContext = createContext<DefaultColumnsContextType>({
  dsUID: '',
  setMetadata: () => undefined,
  metadata: {},
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
  const [metadata, setMetadata] = useState<ObjectMeta | null>(null);
  const [dsUID, setDsUID] = useState(initialDSUID);

  const handleSetMetadata = useCallback((metadata: ObjectMeta | null) => {
    setMetadata(metadata);
  }, []);

  const handleSetDsUID = useCallback((dsUID: string) => {
    setDsUID(dsUID);
    setApiDefaultColumnsState(null);
    setLocalDefaultColumnsState(null);
  }, []);

  /**
   * Sets the entire app state
   */
  const handleSetLocalDefaultColumnsState = useCallback((state: LocalDefaultColumnsState) => {
    // the objects returned by the API are readonly/immutable, and it's a huge pain destructuring (shallow cloning) nested objects when you want to update a record at a specific index
    // Since react state isn't mutatable is there a good reason (besides negligible performance overhead) not to clone (removing the immutable)?
    // I'm guessing the readonly status of the API response is to keep developers from accidentally mutating and as a result making bad assumptions about the data
    setLocalDefaultColumnsState(cloneDeep(state));
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
    (state?: LocalLogsDrilldownDefaultColumnsSpec) => {
      const newState = { ...localDefaultColumnsState, [dsUID ?? '']: state };
      setLocalDefaultColumnsState(newState);
    },
    [dsUID, localDefaultColumnsState]
  );

  return (
    <DefaultColumnsContext.Provider
      value={{
        metadata,
        setMetadata: handleSetMetadata,
        dsUID,
        setDsUID: handleSetDsUID,
        apiDefaultColumnsState,
        localDefaultColumnsState,
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
