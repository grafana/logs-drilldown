import React from 'react';

import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';

import { Columns } from './Columns';
import { useDefaultColumnsContext } from './Context';
import { LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecords } from './types';

interface Props {
  recordIndex: number;
}

export function ColumnsDragContext({ recordIndex }: Props) {
  const { setRecords, records } = useDefaultColumnsContext();
  const record = records?.[recordIndex];
  const columns = record?.columns ?? [];
  const onDragEnd = (result: DropResult) => {
    if (!result.destination || !records) {
      return;
    }
    reorderColumn({
      columns,
      records,
      recordIndex,
      setRecords,
      sourceIndex: result.source.index,
      destinationIndex: result.destination.index,
    });
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="order-fields" direction="vertical">
        {(provided, snapshot) => (
          <div {...provided.droppableProps} ref={provided.innerRef}>
            <Columns containerDragging={snapshot.isDraggingOver} recordIndex={recordIndex} />
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}

interface ReorderColumnsProps {
  columns: string[];
  destinationIndex: number;
  recordIndex: number;
  records: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecords;
  setRecords: (records: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecords) => void;
  sourceIndex: number;
}

function reorderColumn({
  records,
  columns,
  recordIndex,
  sourceIndex,
  destinationIndex,
  setRecords,
}: ReorderColumnsProps) {
  const [source] = columns.splice(sourceIndex, 1);
  columns.splice(destinationIndex, 0, source);

  if (records) {
    const recordToUpdate = records[recordIndex];
    recordToUpdate.columns = columns;

    setRecords(records);
  }
}
