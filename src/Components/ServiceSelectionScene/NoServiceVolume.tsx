import React from 'react';

import { t } from '@grafana/i18n';
import { EmptyState } from '@grafana/ui';

export const NoServiceVolume = (props: { labelName: string }) => {
  return (
    <EmptyState
      variant="not-found"
      message={t('components.service-selection-scene.no-service-volume.title', 'No logs found in {{labelName}}.', {
        labelName: props.labelName,
      })}
    >
      {t('components.service-selection-scene.no-service-volume.help', 'Please adjust time range or select another label.')}
    </EmptyState>
  );
};
