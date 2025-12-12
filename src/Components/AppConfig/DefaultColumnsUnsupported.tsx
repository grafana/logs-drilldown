import React from 'react';

import { config } from '@grafana/runtime';

export function DefaultColumnsUnsupported() {
  return (
    <section>
      <h2>Default columns</h2>
      {(!config.featureToggles.kubernetesLogsDrilldown ||
        !config.featureToggles.grafanaAPIServerWithExperimentalAPIs) && (
        <p>
          Default columns requires <code>kubernetesLogsDrilldown</code> and{' '}
          <code>grafanaAPIServerWithExperimentalAPIs</code> feature flags to be enabled.
        </p>
      )}
      {config.buildInfo.version < '12.4' && <p>Default columns requires Grafana 12.4 or greater.</p>}
    </section>
  );
}
