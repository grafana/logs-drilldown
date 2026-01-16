import { useCallback, useEffect, useState } from 'react';

import semver from 'semver/preload';
import { v4 as uuidv4 } from 'uuid';

import { OrgRole } from '@grafana/data';
import { config } from '@grafana/runtime';

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

const MIN_VERSION = '12.4.0';
const isQueryLibrarySupported =
  !semver.ltr(config.buildInfo.version, MIN_VERSION) && config.featureToggles.queryLibrary;

export function useInitSavedSearch(dsUid: string) {
  useHasSavedSearches(dsUid);
}

export function useCheckForExistingSearch(dsUid: string, query: string) {
  const { searches } = useSavedSearches(dsUid);

  return searches.find((search) => search.query === query);
}

export function useHasSavedSearches(dsUid: string) {
  const { searches } = useSavedSearches(dsUid);
  return searches.length > 0;
}

function useRemoteSavedSearches(dsUid: string) {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const { data, isLoading } = useListQueryQuery({}, { refetchOnMountOrArgChange: 300 });
  const [addQuery] = useCreateQueryMutation();
  const [editQueryTemplate] = useUpdateQueryMutation();
  const [deleteQueryTemplate] = useDeleteQueryMutation();

  useEffect(() => {
    if (!isLoading && data) {
      setSearches(convertDataQueryResponseToSavedSearchDTO(data).filter((search) => search.dsUid === dsUid));
    }
  }, [data, dsUid, isLoading]);

  const editSearch = useCallback(
    async (uid: string, search: Partial<SavedSearch>) => {
      await editQueryTemplate({
        name: uid || '',
        patch: {
          spec: {
            ...search,
          },
        },
      }).unwrap();
    },
    [editQueryTemplate]
  );

  const deleteSearch = useCallback(
    async (uid: string) => {
      await deleteQueryTemplate({
        name: uid,
      }).unwrap();
    },
    [deleteQueryTemplate]
  );

  const saveSearch = useCallback(
    async (search: Omit<SavedSearch, 'timestamp' | 'uid'>) => {
      await addQuery({
        query: convertAddQueryTemplateCommandToDataQuerySpec(search),
      });
    },
    [addQuery]
  );

  return {
    backend: 'remote',
    isLoading,
    saveSearch,
    searches,
    deleteSearch,
    editSearch,
  };
}

function useLocalSavedSearches(dsUid: string) {
  const [searches, setSearches] = useState<SavedSearch[]>(getLocallySavedSearches(dsUid));

  const editSearch = useCallback(async (uid: string, search: Partial<SavedSearch>) => {
    logger.error('[Save search]: Editing is not supported in local storage');
  }, []);

  const deleteSearch = useCallback(
    async (uid: string) => {
      removeFromLocalStorage(uid);
      setSearches(getLocallySavedSearches(dsUid));
    },
    [dsUid]
  );

  const saveSearch = useCallback(async (search: Omit<SavedSearch, 'timestamp' | 'uid'>) => {
    saveInLocalStorage(search);
  }, []);

  return {
    backend: 'local',
    isLoading: false,
    saveSearch,
    searches,
    deleteSearch,
    editSearch,
  };
}

export const useSavedSearches = isQueryLibrarySupported ? useRemoteSavedSearches : useLocalSavedSearches;

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
  canModify?: boolean;
  description: string;
  dsUid: string;
  isEditable?: boolean;
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

export const AnnoKeyCreatedBy = 'grafana.app/createdBy';
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
        isEditable:
          config.bootData.user.isGrafanaAdmin ||
          config.bootData.user.orgRole === OrgRole.Admin ||
          spec.metadata?.annotations?.[AnnoKeyCreatedBy]?.replace('user:', '') === config.bootData.user.uid,
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
