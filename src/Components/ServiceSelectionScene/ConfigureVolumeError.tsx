import React from 'react';

import { t } from '@grafana/i18n';
import { EmptyState, Text, TextLink } from '@grafana/ui';

export const ConfigureVolumeError = () => {
  return (
    <EmptyState
      variant="not-found"
      message={t('components.service-selection-scene.configure-volume-error.title', 'Log volume has not been configured.')}
    >
      <p>
        <TextLink href="https://grafana.com/docs/loki/latest/reference/api/#query-log-volume" external>
          {t(
            'components.service-selection-scene.configure-volume-error.docs-link',
            'Instructions to enable volume in the Loki config:'
          )}
        </TextLink>
      </p>
      <Text textAlignment="left">
        <pre>
          {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings -- Config syntax example, not user-facing text */}
          <code>
            limits_config:
            <br />
            &nbsp;&nbsp;volume_enabled: true
          </code>
        </pre>
      </Text>
    </EmptyState>
  );
};
