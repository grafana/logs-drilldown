import React, { useEffect, useMemo } from 'react';

import { EmbeddedLogsMiniScene } from './EmbeddedLogsMiniScene';
import { EmbeddedLogsMiniProps } from './types';

// Built from scratch: does not reuse IndexScene/ServiceScene or any other existing scene.
export default function EmbeddedLogsMini({ datasourceUid, query, timeRange }: EmbeddedLogsMiniProps) {
  const scene = useMemo(
    () => new EmbeddedLogsMiniScene({ datasourceUid, query, timeRange }),
    [datasourceUid, query, timeRange]
  );

  useEffect(() => scene.activate(), [scene]);

  return <scene.Component model={scene} />;
}
