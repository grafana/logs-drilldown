import React from 'react';

import { t } from '@grafana/i18n';
import { EmptyState } from '@grafana/ui';

export const NoServiceVolume = (props: { labelName: string }) => {
  return (
    <EmptyState
      variant="not-found"
      message={t('Components.logs.logs-drilldown.no-service-volume.title', 'No logs found in {{labelName}}.', {
        labelName: props.labelName,
      })}
    >
      {t('Components.logs.logs-drilldown.no-service-volume.help', 'Please adjust time range or select another label.')}
    </EmptyState>
  );
};
