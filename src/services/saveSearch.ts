import { useCallback, useEffect, useState } from 'react';

import { v4 as uuidv4 } from 'uuid';

import pluginJson from '../plugin.json';
import { logger } from './logger';
import { narrowSavedSearches } from './narrowing';
import {
  ListQueryApiResponse,
  useCreateQueryMutation,
  useDeleteQueryMutation,
  useListQueryQuery,
  useUpdateQueryMutation,
} from 'lib/api-clients/queries/v1beta1';

let backend: 'local' | 'remote' | undefined = undefined;
export function useInitSavedSearch(dsUid: string) {
  useHasSavedSearches(dsUid);
}

export function useSaveSearch() {
  const [addQuery] = useCreateQueryMutation();

  const saveSearch = useCallback(
    async (search: Omit<SavedSearch, 'timestamp' | 'uid'>) => {
      if (backend === undefined) {
        logger.error('[Save search]: Uninitialized');
        return;
      } else if (backend === 'local') {
        saveInLocalStorage(search);
      } else {
        await addQuery({
          query: convertAddQueryTemplateCommandToDataQuerySpec(search),
        });
      }
    },
    [addQuery]
  );

  return { saveSearch, backend };
}

export function useCheckForExistingSearch(dsUid: string, query: string) {
  const { searches } = useSavedSearches(dsUid);

  return searches.find((search) => search.query === query);
}

export function useHasSavedSearches(dsUid: string) {
  const { searches } = useSavedSearches(dsUid);
  return searches.length > 0;
}

function useListQueryQueryWrapper() {
  try {
    return useListQueryQuery({}, { refetchOnMountOrArgChange: 300 });
  } catch (e) {
    return { data: undefined, isLoading: false, error: true };
  }
}

export function useSavedSearches(dsUid: string) {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const { data, isLoading, error } = useListQueryQueryWrapper();
  const [editQueryTemplate] = useUpdateQueryMutation();
  const [deleteQueryTemplate] = useDeleteQueryMutation();

  useEffect(() => {
    if (error) {
      setSearches(getLocallySavedSearches(dsUid));
      backend = 'local';
    } else if (!isLoading && data) {
      setSearches(convertDataQueryResponseToSavedSearchDTO(data).filter((search) => search.dsUid === dsUid));
      backend = 'remote';
    }
  }, [data, dsUid, error, isLoading]);

  const editSearch = useCallback(
    async (uid: string, search: Partial<SavedSearch>) => {
      if (backend === undefined) {
        logger.error('[Save search]: Uninitialized');
        return;
      } else if (backend === 'local') {
        logger.error('[Save search]: Editing is not supported in local storage');
      } else {
        await editQueryTemplate({
          name: uid || '',
          patch: {
            spec: {
              ...search,
            },
          },
        }).unwrap();
      }
    },
    [editQueryTemplate]
  );

  const deleteSearch = useCallback(
    async (uid: string) => {
      if (backend === undefined) {
        logger.error('[Save search]: Uninitialized');
        return;
      } else if (backend === 'local') {
        removeFromLocalStorage(uid);
        setSearches(getLocallySavedSearches(dsUid));
      } else {
        await deleteQueryTemplate({
          name: uid,
        }).unwrap();
      }
    },
    [deleteQueryTemplate, dsUid]
  );

  return {
    isLoading,
    searches,
    deleteSearch,
    editSearch,
  };
}

export function getLocallySavedSearches(dsUid?: string) {
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
  isLocked?: boolean;
  isVisible?: boolean;
  query: string;
  timestamp: number;
  title: string;
  uid: string;
}

function saveInLocalStorage({ query, title, description, dsUid }: Omit<SavedSearch, 'timestamp' | 'uid'>) {
  const stored = getLocallySavedSearches(dsUid);

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

export const convertAddQueryTemplateCommandToDataQuerySpec = (
  addQueryTemplateCommand: Omit<SavedSearch, 'timestamp' | 'uid'>
) => {
  const { dsUid, title, query, description, isVisible } = addQueryTemplateCommand;
  return {
    metadata: {
      /**
       * Server will append to whatever is passed here, but just to be safe we generate a uuid
       * More info https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#idempotency
       */
      generateName: uuidv4(),
    },
    spec: {
      title,
      description,
      isVisible,
      vars: [], // TODO: Detect variables in #86838
      tags: [],
      targets: [
        {
          variables: {},
          properties: {
            datasource: {
              uid: dsUid,
              type: 'loki',
            },
            expr: query,
          },
        },
      ],
      isLocked: true,
    },
  };
};
