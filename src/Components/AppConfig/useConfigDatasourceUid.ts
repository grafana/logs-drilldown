import { useEffect, useState } from 'react';

import { logger } from 'services/logger';
import { getDefaultDatasourceUid, getLastUsedDataSourceFromStorage } from 'services/store';

// Last used datasource wins; otherwise resolve the default one.
export function useConfigDatasourceUid(): { dsUID: string | undefined; isLoading: boolean } {
  const lastUsed = getLastUsedDataSourceFromStorage();
  const [resolved, setResolved] = useState<{ dsUID: string | undefined; isLoading: boolean }>({
    dsUID: undefined,
    isLoading: !lastUsed,
  });

  useEffect(() => {
    if (lastUsed) {
      return undefined;
    }

    let cancelled = false;
    getDefaultDatasourceUid()
      .catch((error) => {
        logger.error(error, { msg: 'Failed to resolve the default Loki datasource' });
        return undefined;
      })
      .then((dsUID) => {
        if (!cancelled) {
          setResolved({ dsUID, isLoading: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [lastUsed]);

  return { dsUID: lastUsed ?? resolved.dsUID, isLoading: !lastUsed && resolved.isLoading };
}
