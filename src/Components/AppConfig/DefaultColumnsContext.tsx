import React, { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import { cloneDeep } from 'lodash';

import {
  LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords,
  ObjectMeta,
} from '../../lib/api-clients/logsdrilldown/v1alpha1';
import { recordsHaveDuplicates } from './DefaultColumnsState';
import {
  APIColumnsState,
  DefaultColumnsState,
  LocalDefaultColumnsState,
  LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecords,
  LocalLogsDrilldownDefaultColumnsSpec,
} from './types';

type DefaultColumnsContextType = {
  apiDefaultColumnsState?: DefaultColumnsState | null;
  apiRecords: LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords | null;
  dsUID: string;
  metadata: ObjectMeta | null;
  records: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecords | null;
  setApiDefaultColumnsState: (defaultColumnsState: APIColumnsState) => void;
  setDsUID: (dsUID: string) => void;
  setMetadata: (m: ObjectMeta | null) => void;
  setRecords: (records: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecords) => void;
  validation: {
    hasDuplicates: boolean;
    hasInvalidRecords: boolean;
    isInvalid: boolean;
  };
};

const DefaultColumnsContext = createContext<DefaultColumnsContextType>({
  apiDefaultColumnsState: undefined,
  apiRecords: null,
  dsUID: '',
  metadata: {},
  records: null,
  setApiDefaultColumnsState: () => undefined,
  setDsUID: () => undefined,
  setMetadata: () => undefined,
  setRecords: () => undefined,
  validation: {
    isInvalid: false,
    hasDuplicates: false,
    hasInvalidRecords: false,
  },
});

interface Props {
  children: ReactNode;
  initialDSUID: string;
}
export const DefaultColumnsContextProvider = ({ children, initialDSUID }: Props) => {
  const [localDefaultColumnsState, setLocalDefaultColumnsState] = useState<LocalDefaultColumnsState | null>(null);
  const [apiDefaultColumnsState, setApiDefaultColumnsState] = useState<APIColumnsState | null>(null);
  const [metadata, setMetadata] = useState<ObjectMeta | null>(null);
  const [dsUID, setDsUID] = useState(initialDSUID);
  const records = localDefaultColumnsState?.[dsUID]?.records ?? null;
  const apiRecords = apiDefaultColumnsState?.[dsUID].records ?? null;

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
    (state: APIColumnsState) => {
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

  /**
   * Sets the local records state
   */
  const handleSetRecords = useCallback(
    (records: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecords) => {
      handleSetLocalDefaultColumnsDatasourceState({ records });
    },
    [handleSetLocalDefaultColumnsDatasourceState]
  );

  const { isInvalid, hasDuplicates, hasInvalidRecords } = useMemo(() => {
    // Use a local reference to records to force useMemo to re-run when the localDefaultColumnsState reference changes
    const records = localDefaultColumnsState?.[dsUID]?.records ?? null;
    const invalidRecords = records?.filter(
      (r) =>
        !(
          r.columns.length &&
          r.labels.length &&
          r.labels.every(
            (l) => l.key !== '' // this line is intentionally left blank for formatting purposes
          ) &&
          r.columns.every((c) => c)
        )
    );

    const hasDuplicates = records ? recordsHaveDuplicates(records) : false;
    const hasInvalidRecords = (invalidRecords && invalidRecords?.length > 0) ?? false;
    const isInvalid = hasInvalidRecords && hasDuplicates;

    return { hasDuplicates, hasInvalidRecords, isInvalid };
    // ¡if you just pass in records to this dep array we won't run validation on changes to record labels/columns!
  }, [dsUID, localDefaultColumnsState]);

  return (
    <DefaultColumnsContext.Provider
      value={{
        apiRecords,
        records,
        validation: {
          hasDuplicates,
          isInvalid,
          hasInvalidRecords,
        },
        metadata,
        setMetadata: handleSetMetadata,
        dsUID,
        setDsUID: handleSetDsUID,
        apiDefaultColumnsState,
        setApiDefaultColumnsState: handleSetApiDefaultColumnsState,
        setRecords: handleSetRecords,
      }}
    >
      {children}
    </DefaultColumnsContext.Provider>
  );
};

export const useDefaultColumnsContext = () => {
  return useContext(DefaultColumnsContext);
};
