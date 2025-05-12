import React, { useEffect } from 'react';

import { PatternsLogsSampleScene } from './PatternsLogsSampleScene';
import { PatternsTableCellData, PatternsViewTableScene } from './PatternsViewTableScene';

interface ExpandedRowProps {
  row: PatternsTableCellData;
  tableViz: PatternsViewTableScene;
}

export function PatternsTableExpandedRow({ row, tableViz }: ExpandedRowProps) {
  const { expandedRows } = tableViz.useState();

  const rowScene = expandedRows?.find((scene) => scene.state.key === row.pattern);

  useEffect(() => {
    if (!rowScene) {
      const newRowScene = buildExpandedRowScene(row.pattern);
      tableViz.setState({ expandedRows: [...(tableViz.state.expandedRows ?? []), newRowScene] });
    }
  }, [row, tableViz, rowScene]);

  return rowScene ? <rowScene.Component model={rowScene} /> : null;
}

function buildExpandedRowScene(pattern: string) {
  return new PatternsLogsSampleScene({
    key: pattern,
    pattern: pattern,
  });
}
