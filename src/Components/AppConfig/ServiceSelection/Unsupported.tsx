import React from 'react';

import { Trans } from '@grafana/i18n';

import { isDefaultLabelsFlagsSupported, isDefaultLabelsVersionSupported } from './isSupported';

export function Unsupported() {
  return (
    <section>
      <h2>
        <Trans i18nKey="components.app-config.service-selection.unsupported.landing-page">Landing Page</Trans>
      </h2>
      {!isDefaultLabelsFlagsSupported() && (
        <p>
          <Trans i18nKey="components.app-config.service-selection.unsupported.landing-requires-feature-flag">
            Landing Page settings requires <code>kubernetesLogsDrilldown</code> feature flag to be enabled.
          </Trans>
        </p>
      )}
      {!isDefaultLabelsVersionSupported && (
        <p>
          <Trans i18nKey="components.app-config.service-selection.unsupported.landing-settings-requires-grafana-greater">
            Landing Page settings requires Grafana 13.0 or greater.
          </Trans>
        </p>
      )}
    </section>
  );
}
