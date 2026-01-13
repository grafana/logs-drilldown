import React from 'react';

import { isDefaultColumnsFlagsSupported, isDefaultColumnsVersionSupported } from './MinVersion';

export function Unsupported() {
  return (
    <section>
      <h2>Default columns</h2>
      {!isDefaultColumnsFlagsSupported && (
        <p>
          Default columns requires <code>kubernetesLogsDrilldown</code> feature flag to be enabled.
        </p>
      )}
      {!isDefaultColumnsVersionSupported && <p>Default columns requires Grafana 12.4 or greater.</p>}
    </section>
  );
}
