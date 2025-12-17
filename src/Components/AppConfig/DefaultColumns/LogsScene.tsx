import React from 'react';

import { SceneContextProvider } from '@grafana/scenes-react';

import { useDefaultColumnsContext } from './Context';
import { getColumnsLabelsExpr, mapColumnsLabelsToAdHocFilters } from './LabelsQueries';
import { LogsView } from './LogsView';

interface Props {
  recordIndex: number;
}
export function LogsScene({ recordIndex }: Props) {
  const { records } = useDefaultColumnsContext();
  const record = records?.[recordIndex];
  const labelFilters = mapColumnsLabelsToAdHocFilters(record?.labels ?? []);
  const expr = getColumnsLabelsExpr(labelFilters);

  if (!expr) {
    return null;
  }

  return (
    <SceneContextProvider timeRange={{ from: 'now-24h', to: 'now' }} withQueryController>
      <LogsView recordIndex={recordIndex} expr={expr} />
    </SceneContextProvider>
  );
}
