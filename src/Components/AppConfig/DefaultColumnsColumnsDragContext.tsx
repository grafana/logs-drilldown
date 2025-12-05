import React from 'react';

import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';

import { DefaultColumnsColumns } from './DefaultColumnsColumns';
import { useDefaultColumnsContext } from './DefaultColumnsContext';
import { LocalDefaultColumnsState, LocalLogsDrilldownDefaultColumnsSpec } from './types';

interface Props {
  recordIndex: number;
}

export function DefaultColumnsColumnsDragContext({ recordIndex }: Props) {
  const { localDefaultColumnsState, dsUID, setLocalDefaultColumnsDatasourceState } = useDefaultColumnsContext();
  const record = localDefaultColumnsState?.[dsUID]?.records[recordIndex];
  const columns = record?.columns ?? [];
  const onDragEnd = (result: DropResult) => {
    if (!result.destination || !localDefaultColumnsState) {
      return;
    }
    reorderColumn({
      columns,
      dsUID,
      localDefaultColumnsState,
      recordIndex,
      setLocalDefaultColumnsDatasourceState,
      sourceIndex: result.source.index,
      destinationIndex: result.destination.index,
    });
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="order-fields" direction="vertical">
        {(provided, snapshot) => (
          <div {...provided.droppableProps} ref={provided.innerRef}>
            <DefaultColumnsColumns containerDragging={snapshot.isDraggingOver} recordIndex={recordIndex} />
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}

interface ReorderColumnsProps {
  columns: string[];
  destinationIndex: number;
  dsUID: string;
  localDefaultColumnsState: LocalDefaultColumnsState;
  recordIndex: number;
  setLocalDefaultColumnsDatasourceState: (localDefaultColumnsState?: LocalLogsDrilldownDefaultColumnsSpec) => void;
  sourceIndex: number;
}

function reorderColumn({
  columns,
  localDefaultColumnsState,
  dsUID,
  setLocalDefaultColumnsDatasourceState,
  recordIndex,
  sourceIndex,
  destinationIndex,
}: ReorderColumnsProps) {
  const [source] = columns.splice(sourceIndex, 1);
  columns.splice(destinationIndex, 0, source);

  if (localDefaultColumnsState && localDefaultColumnsState[dsUID]) {
    const ds = localDefaultColumnsState[dsUID];
    const records = ds.records;
    const recordToUpdate = records[recordIndex];
    recordToUpdate.columns = columns;

    setLocalDefaultColumnsDatasourceState({ records });
  }
}
