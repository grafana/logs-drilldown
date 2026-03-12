import React from 'react';

import { isDefaultLabelsFlagsSupported, isDefaultLabelsVersionSupported } from './isSupported';

export function Unsupported() {
  return (
    <section>
      <h2>Landing Page</h2>
      {!isDefaultLabelsFlagsSupported && (
        <p>
          Landing Page settings requires <code>kubernetesLogsDrilldown</code> feature flag to be enabled.
        </p>
      )}
      {!isDefaultLabelsVersionSupported && <p>Landing Page settings requires Grafana 13.0 or greater.</p>}
    </section>
  );
}
