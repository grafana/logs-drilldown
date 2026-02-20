import React from 'react';

import { isDefaultLabelsFlagsSupported, isDefaultLabelsVersionSupported } from './isSupported';

export function Unsupported() {
  return (
    <section>
      <h2>Service Selection</h2>
      {!isDefaultLabelsFlagsSupported && (
        <p>
          Service Selection settings requires <code>kubernetesLogsDrilldown</code> feature flag to be enabled.
        </p>
      )}
      {!isDefaultLabelsVersionSupported && <p>Service Selection settings requires Grafana 12.4 or greater.</p>}
    </section>
  );
}
