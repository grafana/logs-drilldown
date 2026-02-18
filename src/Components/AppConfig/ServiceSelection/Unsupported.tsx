import React from 'react';

import { isDefaultLabelsFlagsSupported, isDefaultLabelsVersionSupported } from './isSupported';

export function Unsupported() {
  return (
    <section>
      <h2>Default columns</h2>
      {!isDefaultLabelsFlagsSupported && (
        <p>
          Default columns requires <code>kubernetesLogsDrilldown</code> feature flag to be enabled.
        </p>
      )}
      {!isDefaultLabelsVersionSupported && <p>Default columns requires Grafana 12.4 or greater.</p>}
    </section>
  );
}
