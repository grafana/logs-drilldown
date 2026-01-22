import { ReactNode, useCallback, useState } from 'react';

import semver from 'semver/preload';
import { v4 as uuidv4 } from 'uuid';

import { config } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';

import pluginJson from '../plugin.json';
import { logger } from './logger';
import { narrowSavedSearches } from './narrowing';

const MIN_VERSION = '12.4.0-pre';

export function isQueryLibrarySupported() {
  return !semver.ltr(config.buildInfo.version, MIN_VERSION) && config.featureToggles.queryLibrary;
}

export function useCheckForExistingSearch(dsUid: string, query: string) {
  const { searches } = useSavedSearches(dsUid);

  return searches.find((search) => search.query === query);
}

export function useHasSavedSearches(dsUid: string) {
  const { searches } = useSavedSearches(dsUid);
  return searches.length > 0;
}

export function useSavedSearches(dsUid: string) {
  const [searches, setSearches] = useState<SavedSearch[]>(getLocallySavedSearches(dsUid));

  const deleteSearch = useCallback(
    async (uid: string) => {
      removeFromLocalStorage(uid);
      setSearches(getLocallySavedSearches(dsUid));
    },
    [dsUid]
  );

  const saveSearch = useCallback(
    async (search: Omit<SavedSearch, 'timestamp' | 'uid'>) => {
      saveInLocalStorage(search);
      setSearches(getLocallySavedSearches(dsUid));
    },
    [dsUid]
  );

  return {
    isLoading: false,
    saveSearch,
    searches,
    deleteSearch,
  };
}

function getLocallySavedSearches(dsUid?: string) {
  let stored: SavedSearch[] = [];
  try {
    stored = narrowSavedSearches(JSON.parse(localStorage.getItem(SAVED_SEARCHES_KEY) ?? '[]'));
  } catch (e) {
    logger.error(e);
  }
  stored.sort((a, b) => b.timestamp - a.timestamp);
  return stored.filter((search) => (dsUid ? search.dsUid === dsUid : true));
}

export const SAVED_SEARCHES_KEY = `${pluginJson.id}.savedSearches`;

export interface SavedSearch {
  description: string;
  dsUid: string;
  query: string;
  timestamp: number;
  title: string;
  uid: string;
}

function saveInLocalStorage({ query, title, description, dsUid }: Omit<SavedSearch, 'timestamp' | 'uid'>) {
  const stored = getLocallySavedSearches();

  stored.push({
    dsUid,
    description,
    query,
    timestamp: new Date().getTime(),
    title,
    uid: uuidv4(),
  });

  localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(stored));
}

function removeFromLocalStorage(uid: string) {
  const stored = getLocallySavedSearches();
  localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(stored.filter((stored) => stored.uid !== uid)));
}

export interface OpenQueryLibraryComponentProps {
  datasourceFilters?: string[];
  fallbackComponent?: ReactNode;
  icon?: string;
  onSelectQuery?(query: DataQuery): void;
  query?: DataQuery;
  tooltip?: string;
}
