import { useEffect, useState } from 'react';

import { AppPluginMeta } from '@grafana/data';

import { plugin } from '../module';
import { isKgAnnotationsAvailable } from './kgAnnotations';
import { logger } from './logger';
import { getDefaultDatasourceUid, getLastUsedDataSourceFromStorage } from './store';
import type { JsonData } from 'Components/AppConfig/AppConfig';

export type InitialDatasourceInfo = {
  defaultDatasourceUid: string | undefined;
  kgAnnotationsAvailable: boolean;
};

const FALLBACK_DATASOURCE_UID = 'grafanacloud-logs';

let current: InitialDatasourceInfo = { defaultDatasourceUid: undefined, kgAnnotationsAvailable: false };
let hasResolved = false;
let hasWarnedUnresolved = false;
const inFlight = new Map<boolean, Promise<InitialDatasourceInfo>>();

// Sync read for constructors, which can't await; call resolveInitialDatasourceInfo first.
export function getInitialDatasourceInfo(): InitialDatasourceInfo {
  if (!hasResolved && !hasWarnedUnresolved) {
    hasWarnedUnresolved = true;
    logger.warn('Initial datasource info was read before it was resolved');
  }
  return current;
}

// Order: plugin setting, last used, resolved default, fallback.
export function getInitialDatasourceUid(): string {
  const { jsonData } = plugin.meta as AppPluginMeta<JsonData>;
  return (
    jsonData?.dataSource ??
    getLastUsedDataSourceFromStorage() ??
    getInitialDatasourceInfo().defaultDatasourceUid ??
    FALLBACK_DATASOURCE_UID
  );
}

async function loadInitialDatasourceInfo(lookUpDefault: boolean): Promise<InitialDatasourceInfo> {
  const [defaultDatasourceUid, kgAnnotationsAvailable] = await Promise.all([
    lookUpDefault
      ? getDefaultDatasourceUid().catch((error) => {
          logger.error(error, { msg: 'Failed to resolve the default Loki datasource' });
          return undefined;
        })
      : undefined,
    isKgAnnotationsAvailable().catch((error) => {
      logger.warn('Failed to check for the knowledge graph datasource', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }),
  ]);

  // A request that skipped the default lookup must not erase a default another request resolved.
  current = {
    defaultDatasourceUid: lookUpDefault ? defaultDatasourceUid : current.defaultDatasourceUid,
    kgAnnotationsAvailable,
  };
  hasResolved = true;
  return current;
}

type ResolveOptions = {
  // false skips the default lookup when the datasource is already known
  needsDefaultDatasource?: boolean;
  // true skips the default datasource lookup and uses the last used datasource from localStorage; config pages leave it off
  preferLastUsed?: boolean;
};

// Concurrent callers share one request. Never rejects.
export function resolveInitialDatasourceInfo({
  needsDefaultDatasource = true,
  preferLastUsed = false,
}: ResolveOptions = {}): Promise<InitialDatasourceInfo> {
  const lookUpDefault = needsDefaultDatasource && !(preferLastUsed && getLastUsedDataSourceFromStorage());
  const existing = inFlight.get(lookUpDefault);
  if (existing) {
    return existing;
  }
  const request = loadInitialDatasourceInfo(lookUpDefault).finally(() => inFlight.delete(lookUpDefault));
  inFlight.set(lookUpDefault, request);
  return request;
}

// Pass the datasource uid when it is already known to skip the default lookup.
export function useDefaultDatasourceUid(
  knownDatasourceUid?: string,
  { preferLastUsed = false }: Pick<ResolveOptions, 'preferLastUsed'> = {}
): {
  dsUID: string | undefined;
  isLoading: boolean;
} {
  const needsDefaultDatasource = !knownDatasourceUid;
  const [info, setInfo] = useState<InitialDatasourceInfo>();

  useEffect(() => {
    resolveInitialDatasourceInfo({ needsDefaultDatasource, preferLastUsed })
      .then(setInfo)
      .catch((error) => {
        logger.error(error, { msg: 'Failed to resolve the initial datasource' });
        setInfo(getInitialDatasourceInfo());
      });
  }, [needsDefaultDatasource, preferLastUsed]);

  return { dsUID: info?.defaultDatasourceUid, isLoading: !info };
}
