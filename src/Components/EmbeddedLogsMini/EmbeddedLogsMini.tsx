import React, { useEffect, useMemo } from 'react';

import { EmbeddedLogsMiniScene } from './EmbeddedLogsMiniScene';
import { EmbeddedLogsMiniProps } from './types';

// Built from scratch: does not reuse IndexScene/ServiceScene or any other existing scene.
export default function EmbeddedLogsMini({
  datasourceUid,
  logsOptions,
  query,
  showLogsVolume,
  timeRange,
  visualizationType,
}: EmbeddedLogsMiniProps) {
  const scene = useMemo(
    () =>
      new EmbeddedLogsMiniScene({ datasourceUid, logsOptions, query, showLogsVolume, timeRange, visualizationType }),
    [datasourceUid, logsOptions, query, showLogsVolume, timeRange, visualizationType]
  );

  useEffect(() => scene.activate(), [scene]);

  return <scene.Component model={scene} />;
}
