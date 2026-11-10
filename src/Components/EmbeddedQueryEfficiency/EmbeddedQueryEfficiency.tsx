import React, { useEffect, useMemo } from 'react';

import { EmbeddedQueryEfficiencyScene } from './EmbeddedQueryEfficiencyScene';
import { EmbeddedQueryEfficiencyProps } from './types';

// Built from scratch: does not reuse IndexScene/ServiceScene or any other existing scene.
export default function EmbeddedQueryEfficiency({ query }: EmbeddedQueryEfficiencyProps) {
  const scene = useMemo(() => new EmbeddedQueryEfficiencyScene({ query }), [query]);

  useEffect(() => scene.activate(), [scene]);

  return <scene.Component model={scene} />;
}
