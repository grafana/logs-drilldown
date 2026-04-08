import React from 'react';

import { t } from '@grafana/i18n';
import { EmptyState } from '@grafana/ui';

export const NoServiceSearchResults = () => {
  return (
    <EmptyState
      variant="not-found"
      message={t('components.logs.logs-drilldown.no-service-search-results.title', 'No service matched your search.')}
    />
  );
};
