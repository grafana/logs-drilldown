import React from 'react';

import { SceneContextProvider } from '@grafana/scenes-react';

import { useDefaultColumnsContext } from './DefaultColumnsContext';
import { getColumnsLabelsExpr, mapColumnsLabelsToAdHocFilters } from './DefaultColumnsLabelsQueries';
import { DefaultColumnsLogsView } from './DefaultColumnsLogsView';

interface Props {
  recordIndex: number;
}
export function DefaultColumnsLogsScene({ recordIndex }: Props) {
  const { dsUID, localDefaultColumnsState } = useDefaultColumnsContext();
  const ds = localDefaultColumnsState?.[dsUID];
  const record = ds?.records[recordIndex];
  const labelFilters = mapColumnsLabelsToAdHocFilters(record?.labels ?? []);
  const expr = getColumnsLabelsExpr(labelFilters);

  if (!expr) {
    return null;
  }

  return (
    <SceneContextProvider timeRange={{ from: 'now-24h', to: 'now' }} withQueryController>
      <DefaultColumnsLogsView recordIndex={recordIndex} expr={expr} />
    </SceneContextProvider>
  );
}
