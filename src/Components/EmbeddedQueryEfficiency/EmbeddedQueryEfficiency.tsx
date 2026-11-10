import React, { useEffect, useMemo } from 'react';

import { dateTime, TimeRange } from '@grafana/data';

import { EmbeddedQueryEfficiencyScene } from './EmbeddedQueryEfficiencyScene';
import { EmbeddedQueryEfficiencyProps } from './types';

function buildDefaultTimeRange(): TimeRange {
  const to = dateTime();
  const from = dateTime(to).subtract(15, 'minute');
  return { from, raw: { from: 'now-15m', to: 'now' }, to };
}

// Built from scratch: does not reuse IndexScene/ServiceScene or any other existing scene.
export default function EmbeddedQueryEfficiency({ datasourceUid, query, timeRange }: EmbeddedQueryEfficiencyProps) {
  const resolvedTimeRange = useMemo(() => timeRange ?? buildDefaultTimeRange(), [timeRange]);
  const scene = useMemo(
    () => new EmbeddedQueryEfficiencyScene({ datasourceUid, query, timeRange: resolvedTimeRange }),
    [datasourceUid, query, resolvedTimeRange]
  );

  useEffect(() => scene.activate(), [scene]);

  return <scene.Component model={scene} />;
}
