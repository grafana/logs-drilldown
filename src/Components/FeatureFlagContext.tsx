import React, { ReactNode, useEffect, useState } from 'react';

import { t } from '@grafana/i18n';
import { LoadingPlaceholder } from '@grafana/ui';

import { initializeFeatureFlags, initOpenFeatureProvider } from 'featureFlags/openFeature';
import { logger } from 'services/logger';

// Initialize OpenFeature provider and populate flag cache
const featureFlagsReady = initOpenFeatureProvider().then(() => initializeFeatureFlags());

export const FeatureFlagContext = ({ children }: { children: ReactNode }) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Initialize and cache the feature flags for use in the app
    featureFlagsReady
      .then(() => {
        setIsReady(true);
      })
      .catch((err) => {
        logger.error(err, { msg: 'Feature flags failed to load' });
        setIsReady(true);
      });
  }, []);

  // Show a loading spinner until the feature flags are ready
  if (!isReady) {
    return <LoadingPlaceholder text={t('components.app.text-loading', 'Loading...')} />;
  }

  return children;
};
