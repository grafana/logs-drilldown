import { isKgAnnotationsAvailable } from './kgAnnotations';
import { logger } from './logger';
import { getDefaultDatasourceUid, getLastUsedDataSourceFromStorage } from './store';

export type InitialDatasourceInfo = {
  defaultDatasourceUid: string | undefined;
  kgAnnotationsAvailable: boolean;
};

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

// Order: explicit state, plugin setting, last used, resolved default, fallback.
export function chooseDatasourceUid(sources: {
  fallback: string;
  lastUsed?: string;
  pluginSettings?: string;
  state?: string;
}): string {
  return (
    sources.state ??
    sources.pluginSettings ??
    sources.lastUsed ??
    getInitialDatasourceInfo().defaultDatasourceUid ??
    sources.fallback
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

  current = { defaultDatasourceUid, kgAnnotationsAvailable };
  hasResolved = true;
  return current;
}

// needsDefaultDatasource: false skips the default lookup when the datasource is already known.
// Concurrent callers share one request. Never rejects.
export function resolveInitialDatasourceInfo({
  needsDefaultDatasource = true,
}: { needsDefaultDatasource?: boolean } = {}): Promise<InitialDatasourceInfo> {
  const lookUpDefault = needsDefaultDatasource && !getLastUsedDataSourceFromStorage();
  let request = inFlight.get(lookUpDefault);
  if (!request) {
    request = loadInitialDatasourceInfo(lookUpDefault).finally(() => inFlight.delete(lookUpDefault));
    inFlight.set(lookUpDefault, request);
  }
  return request;
}
