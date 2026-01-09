import { useEffect, useState } from 'react';

import { v4 as uuidv4 } from 'uuid';

import pluginJson from '../plugin.json';
import { logger } from './logger';
import { narrowSavedSearches } from './narrowing';
import { ListQueryApiResponse, useListQueryQuery } from 'lib/api-clients/v1beta1';

export async function saveSearch(query: string, title: string, description: string, dsUid: string) {
  await saveInLocalStorage(query, title, description, dsUid);
}

export function useHasSavedSearches(dsUid: string) {
  const searches = useSavedSearches(dsUid);
  return searches.length > 0;
}

export function useSavedSearches(dsUid: string) {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const { data, isLoading, error } = useListQueryQuery({}, { refetchOnMountOrArgChange: true });

  useEffect(() => {
    if (error) {
      setSearches(getLocallySavedSearches(dsUid));
    } else if (!isLoading && data) {
      setSearches(convertDataQueryResponseToSavedSearchDTO(data).filter((search) => search.dsUid === dsUid));
    }
  }, [data, dsUid, error, isLoading]);

  return searches;
}

export function getLocallySavedSearches(dsUid: string) {
  let stored: SavedSearch[] = [];
  try {
    stored = narrowSavedSearches(JSON.parse(localStorage.getItem(SAVED_SEARCHES_KEY) ?? '[]'));
  } catch (e) {
    logger.error(e);
  }
  stored.sort((a, b) => b.timestamp - a.timestamp);
  return stored.filter((search) => search.dsUid === dsUid);
}

export const SAVED_SEARCHES_KEY = `${pluginJson.id}.savedSearches`;

export interface SavedSearch {
  description: string;
  dsUid: string;
  isLocked: boolean;
  query: string;
  timestamp: number;
  title: string;
  uid: string;
}

function saveInLocalStorage(query: string, title: string, description: string, dsUid: string) {
  const stored = getLocallySavedSearches(dsUid);

  stored.push({
    dsUid,
    description,
    isLocked: false,
    query,
    timestamp: new Date().getTime(),
    title,
    uid: uuidv4(),
  });

  localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(stored));
}

export const convertDataQueryResponseToSavedSearchDTO = (result: ListQueryApiResponse): SavedSearch[] => {
  if (!result.items) {
    return [];
  }
  return result.items
    .filter((spec) => spec.spec?.isVisible !== false)
    .map((spec) => {
      return {
        dsUid: spec.spec?.targets[0]?.properties.datasource?.uid ?? '',
        description: spec.spec?.description ?? '',
        isLocked: spec.spec?.isLocked ?? false,
        query: spec.spec?.targets[0]?.properties.expr ?? '',
        title: spec.spec?.title ?? '',
        uid: spec.metadata?.name ?? '',
        timestamp: new Date(spec.metadata?.creationTimestamp ?? '').getTime(),
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp);
};
