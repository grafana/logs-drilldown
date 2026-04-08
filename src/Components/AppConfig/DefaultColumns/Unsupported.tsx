import React from 'react';

import { Trans } from '@grafana/i18n';

import { isDefaultColumnsFlagsSupported, isDefaultColumnsVersionSupported } from './isSupported';

export function Unsupported() {
  return (
    <section>
      <h2>
        <Trans i18nKey="components.unsupported.default-columns">Default columns</Trans>
      </h2>
      {!isDefaultColumnsFlagsSupported() && (
        <p>
          <Trans i18nKey="components.unsupported.default-columns-requires-feature-flag">
            Default columns requires <code>kubernetesLogsDrilldown</code> feature flag to be enabled.
          </Trans>
        </p>
      )}
      {!isDefaultColumnsVersionSupported && (
        <p>
          <Trans i18nKey="components.unsupported.default-columns-requires-grafana-or-greater">
            Default columns requires Grafana 12.4 or greater.
          </Trans>
        </p>
      )}
    </section>
  );
}
