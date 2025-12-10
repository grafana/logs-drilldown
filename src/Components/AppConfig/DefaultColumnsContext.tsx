import React, { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import { cloneDeep } from 'lodash';

import {
  LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords,
  ObjectMeta,
} from '../../lib/api-clients/logsdrilldown/v1alpha1';
import { isDefaultColumnsStateChanged, recordsHaveDuplicates } from './DefaultColumnsState';
import { isRecordInvalid } from './DefaultColumnsValidation';
import {
  APIColumnsState,
  DefaultColumnsState,
  DefaultColumnsValidationState,
  LocalDefaultColumnsState,
  LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecords,
  LocalLogsDrilldownDefaultColumnsSpec,
} from './types';

type DefaultColumnsContextType = {
  apiDefaultColumnsState?: DefaultColumnsState | null;
  apiRecords: LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords | null;
  dsUID: string;
  expandedRecords: number[];
  metadata: ObjectMeta | null;
  records: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecords | null;
  setApiDefaultColumnsState: (defaultColumnsState: APIColumnsState) => void;
  setDsUID: (dsUID: string) => void;
  setExpandedRecords: (idxs: number[]) => void;
  setMetadata: (m: ObjectMeta | null) => void;
  setRecords: (records: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecords) => void;
  validation: DefaultColumnsValidationState;
};

const DefaultColumnsContext = createContext<DefaultColumnsContextType>({
  apiDefaultColumnsState: undefined,
  apiRecords: null,
  dsUID: '',
  expandedRecords: [],
  metadata: {},
  records: null,
  setApiDefaultColumnsState: () => undefined,
  setDsUID: () => undefined,
  setExpandedRecords: () => undefined,
  setMetadata: () => undefined,
  setRecords: () => undefined,
  validation: {
    isInvalid: false,
    hasDuplicates: false,
    hasInvalidRecords: false,
    hasPendingChanges: false,
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
  const [expandedRecords, setExpandedRecords] = useState<number[]>([]);
  const records = localDefaultColumnsState?.[dsUID]?.records ?? null;
  const apiRecords = apiDefaultColumnsState?.[dsUID].records ?? null;

  /**
   * Sets the API response metadata
   */
  const handleSetMetadata = useCallback((metadata: ObjectMeta | null) => {
    setMetadata(metadata);
  }, []);

  /**
   * Sets the datasource UID and clears the existing state
   */
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
   * Sets the indices of records that are currently expanded
   */
  const handleSetExpandedRecords = useCallback((recordsIdxs: number[]) => {
    setExpandedRecords(recordsIdxs);
  }, []);

  /**
   * Sets the local records state
   */
  const handleSetRecords = useCallback(
    (newRecords: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecords) => {
      handleSetLocalDefaultColumnsDatasourceState({ records: newRecords });
    },
    [handleSetLocalDefaultColumnsDatasourceState]
  );

  /**
   * Validates the current form state
   */
  const { isInvalid, hasDuplicates, hasInvalidRecords, hasPendingChanges } = useMemo(() => {
    // Use a local reference to records to force useMemo to re-run when the localDefaultColumnsState reference changes
    const records = localDefaultColumnsState?.[dsUID]?.records ?? null;
    const invalidRecords = records?.filter((r) => isRecordInvalid(r));
    const hasDuplicates = records ? recordsHaveDuplicates(records) : false;
    const hasInvalidRecords = (invalidRecords && invalidRecords?.length > 0) ?? false;
    const isInvalid = hasInvalidRecords || hasDuplicates;
    const hasPendingChanges = isDefaultColumnsStateChanged(records, apiRecords) ?? false;

    return { hasDuplicates, hasInvalidRecords, isInvalid, hasPendingChanges };
    // ¡if you just pass in records to this dep array we won't run validation on changes to record labels/columns!
  }, [dsUID, localDefaultColumnsState, apiRecords]);

  return (
    <DefaultColumnsContext.Provider
      value={{
        apiRecords,
        records,
        validation: {
          hasDuplicates,
          isInvalid,
          hasInvalidRecords,
          hasPendingChanges,
        },
        metadata,
        setMetadata: handleSetMetadata,
        dsUID,
        setDsUID: handleSetDsUID,
        apiDefaultColumnsState,
        setApiDefaultColumnsState: handleSetApiDefaultColumnsState,
        setRecords: handleSetRecords,
        expandedRecords,
        setExpandedRecords: handleSetExpandedRecords,
      }}
    >
      {children}
    </DefaultColumnsContext.Provider>
  );
};

export const useDefaultColumnsContext = () => {
  return useContext(DefaultColumnsContext);
};
