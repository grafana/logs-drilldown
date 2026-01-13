import React from 'react';

import semver from 'semver/preload';

import { config } from '@grafana/runtime';

export function Unsupported() {
  return (
    <section>
      <h2>Default columns</h2>
      {!config.featureToggles.kubernetesLogsDrilldown && (
        <p>
          Default columns requires <code>kubernetesLogsDrilldown</code> feature flag to be enabled.
        </p>
      )}
      {semver.ltr(config.buildInfo.version, '12.4.0-20854440429') && (
        <p>Default columns requires Grafana 12.4 or greater.</p>
      )}
    </section>
  );
}
